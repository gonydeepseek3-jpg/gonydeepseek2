import { EventEmitter } from 'events';
import { offlineQueueManager } from './offlineQueueManager.js';
import { httpInterceptor } from './httpInterceptor.js';
import { conflictResolver } from './conflictResolver.js';
import { logger } from './logger.js';

const MODULE = 'SyncEngine';

class SyncEngine extends EventEmitter {
  constructor() {
    super();
    this.syncState = 'idle';
    this.isProcessing = false;
    this.syncInterval = null;
    this.processingInterval = parseInt(process.env.PROCESSING_INTERVAL || '5000');
    this.maxRetries = parseInt(process.env.MAX_RETRIES || '3');
    this.baseRetryDelay = 1000;
    this.maxRetryDelay = 300000;
    this.batchSize = 10;
    this.lastSyncTime = null;
    this.syncStats = {
      successCount: 0,
      failureCount: 0,
      conflictCount: 0,
      lastSyncDuration: 0,
    };
  }

  start() {
    if (this.syncInterval) {
      logger.warn(MODULE, 'Sync engine already started');
      return;
    }

    logger.info(MODULE, 'Starting sync engine', {
      processingInterval: this.processingInterval,
      maxRetries: this.maxRetries,
    });

    this.loadLastSyncTime();
    this.setState('idle');

    this.syncInterval = setInterval(() => {
      this.processQueue();
    }, this.processingInterval);
  }

  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      this.setState('idle');
      logger.info(MODULE, 'Sync engine stopped');
    }
  }

  async safeShutdown() {
    logger.info(MODULE, 'Initiating safe shutdown');
    
    this.stop();

    if (this.isProcessing) {
      logger.info(MODULE, 'Waiting for current sync to complete');
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!this.isProcessing) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve();
        }, 10000);
      });
    }

    this.saveLastSyncTime();
    logger.info(MODULE, 'Safe shutdown complete');
  }

  loadLastSyncTime() {
    this.lastSyncTime = offlineQueueManager.getSyncMetadata('last_sync_time');
    if (this.lastSyncTime) {
      const daysSinceSync = (Date.now() - new Date(this.lastSyncTime).getTime()) / (1000 * 60 * 60 * 24);
      logger.info(MODULE, 'Last sync loaded', {
        lastSyncTime: this.lastSyncTime,
        daysSinceSync: daysSinceSync.toFixed(2),
      });
    }
  }

  saveLastSyncTime() {
    this.lastSyncTime = new Date().toISOString();
    offlineQueueManager.setSyncMetadata('last_sync_time', this.lastSyncTime);
  }

  setState(newState) {
    if (this.syncState !== newState) {
      this.syncState = newState;
      logger.debug(MODULE, 'Sync state changed', { state: newState });
      this.emit('sync-state-changed', {
        state: newState,
        stats: this.syncStats,
        lastSyncTime: this.lastSyncTime,
      });
    }
  }

  calculateRetryDelay(retryCount) {
    const delay = Math.min(
      this.baseRetryDelay * Math.pow(2, retryCount),
      this.maxRetryDelay
    );
    
    const jitter = Math.random() * delay * 0.1;
    return Math.floor(delay + jitter);
  }

  async processQueue() {
    if (this.isProcessing || !httpInterceptor.isOnline) {
      return;
    }

    const requests = offlineQueueManager.getRequestsReadyForRetry();
    
    if (requests.length === 0) {
      if (this.syncState !== 'idle') {
        this.setState('idle');
      }
      return;
    }

    this.isProcessing = true;
    this.setState('syncing');

    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    let conflictCount = 0;

    try {
      logger.info(MODULE, 'Processing sync batch', { count: requests.length });

      for (const request of requests.slice(0, this.batchSize)) {
        const result = await this.processRequest(request);
        
        if (result.success) {
          successCount++;
        } else if (result.conflict) {
          conflictCount++;
        } else {
          failureCount++;
        }

        this.emit('sync-progress', {
          processed: successCount + failureCount + conflictCount,
          total: Math.min(requests.length, this.batchSize),
          successCount,
          failureCount,
          conflictCount,
        });
      }

      this.syncStats.successCount += successCount;
      this.syncStats.failureCount += failureCount;
      this.syncStats.conflictCount += conflictCount;
      this.syncStats.lastSyncDuration = Date.now() - startTime;

      this.saveLastSyncTime();

      logger.info(MODULE, 'Sync batch completed', {
        successCount,
        failureCount,
        conflictCount,
        duration: this.syncStats.lastSyncDuration,
      });

      const remainingRequests = offlineQueueManager.getRequestsReadyForRetry();
      if (remainingRequests.length === 0) {
        this.setState('idle');
      }
    } catch (error) {
      logger.error(MODULE, 'Sync batch processing error', { error: error.message });
      this.setState('failed');
    } finally {
      this.isProcessing = false;
    }
  }

  async processRequest(request) {
    logger.debug(MODULE, 'Processing request', {
      id: request.id,
      method: request.method,
      url: request.url,
      retryCount: request.retry_count,
    });

    try {
      const response = await httpInterceptor.executeRequest(request.method, request.url, {
        headers: request.headers,
        body: request.body,
      });

      if (response.ok) {
        offlineQueueManager.updateRequestStatus(request.id, 'completed');
        offlineQueueManager.addSyncLog(request.id, 'completed', 'Request synced successfully', {
          status: response.status,
        });
        logger.info(MODULE, 'Request synced successfully', { id: request.id });
        return { success: true };
      }

      const conflictResult = await conflictResolver.handleConflict(request, response);

      if (conflictResult) {
        offlineQueueManager.addSyncLog(request.id, 'conflict', 'Conflict detected', {
          conflictId: conflictResult.conflictId,
          resolution: conflictResult.resolution,
          status: response.status,
        });

        logger.info(MODULE, 'Conflict detected and handled', {
          requestId: request.id,
          conflictId: conflictResult.conflictId,
          resolution: conflictResult.resolution,
        });
        return { success: false, conflict: true };
      }

      if (request.retry_count >= this.maxRetries) {
        const errorMessage = `Max retries exceeded. Last status: ${response.status}`;
        offlineQueueManager.updateRequestStatus(request.id, 'failed', errorMessage);
        offlineQueueManager.addSyncLog(request.id, 'failed', errorMessage, {
          status: response.status,
          retryCount: request.retry_count,
        });
        logger.warn(MODULE, 'Request failed after max retries', { id: request.id });
        return { success: false };
      }

      const retryDelay = this.calculateRetryDelay(request.retry_count);
      offlineQueueManager.incrementRetryCount(request.id);
      offlineQueueManager.setNextRetryTime(request.id, retryDelay);

      offlineQueueManager.addSyncLog(request.id, 'retry_scheduled', 'Retry scheduled', {
        retryCount: request.retry_count + 1,
        nextRetryInMs: retryDelay,
        status: response.status,
      });

      logger.info(MODULE, 'Request will be retried', {
        id: request.id,
        retryCount: request.retry_count + 1,
        nextRetryIn: `${retryDelay}ms`,
      });

      return { success: false };
    } catch (error) {
      logger.error(MODULE, 'Request processing error', {
        id: request.id,
        error: error.message,
      });

      if (request.retry_count >= this.maxRetries) {
        offlineQueueManager.updateRequestStatus(request.id, 'failed', error.message);
        offlineQueueManager.addSyncLog(request.id, 'failed', error.message, {
          retryCount: request.retry_count,
        });
        return { success: false };
      }

      const retryDelay = this.calculateRetryDelay(request.retry_count);
      offlineQueueManager.incrementRetryCount(request.id);
      offlineQueueManager.setNextRetryTime(request.id, retryDelay);
      offlineQueueManager.addSyncLog(request.id, 'retry_scheduled', 'Retry scheduled after error', {
        retryCount: request.retry_count + 1,
        nextRetryInMs: retryDelay,
        error: error.message,
      });

      return { success: false };
    }
  }

  forceSync() {
    logger.info(MODULE, 'Force sync requested');
    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  getSyncStatus() {
    const queueStats = offlineQueueManager.getQueueStats();
    const pendingConflicts = offlineQueueManager.getPendingConflicts(1).length;

    return {
      state: this.syncState,
      isProcessing: this.isProcessing,
      lastSyncTime: this.lastSyncTime,
      stats: this.syncStats,
      queueStats,
      pendingConflicts,
    };
  }

  resetStats() {
    this.syncStats = {
      successCount: 0,
      failureCount: 0,
      conflictCount: 0,
      lastSyncDuration: 0,
    };
    logger.info(MODULE, 'Sync stats reset');
  }

  updateConfiguration(config) {
    if (config.processingInterval) {
      this.processingInterval = config.processingInterval;
    }
    if (config.maxRetries) {
      this.maxRetries = config.maxRetries;
    }
    if (config.batchSize) {
      this.batchSize = config.batchSize;
    }

    logger.info(MODULE, 'Configuration updated', {
      processingInterval: this.processingInterval,
      maxRetries: this.maxRetries,
      batchSize: this.batchSize,
    });

    if (this.syncInterval) {
      this.stop();
      this.start();
    }
  }
}

export const syncEngine = new SyncEngine();
