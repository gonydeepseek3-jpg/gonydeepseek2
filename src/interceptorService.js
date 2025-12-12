import { offlineQueueManager } from './offlineQueueManager.js';
import { httpInterceptor } from './httpInterceptor.js';
import { credentialStore } from './credentialStore.js';
import { syncEngine } from './syncEngine.js';
import { conflictResolver } from './conflictResolver.js';
import { logger } from './logger.js';

const MODULE = 'InterceptorService';

class InterceptorService {
  constructor() {
    this.initialized = false;
    this.syncStateListeners = [];
    this.syncProgressListeners = [];
  }

  initialize() {
    try {
      if (this.initialized) return true;

      logger.info(MODULE, 'Initializing interceptor service');

      if (!offlineQueueManager.initialize()) {
        logger.error(MODULE, 'Failed to initialize offline queue manager');
        return false;
      }

      syncEngine.start();
      this.initialized = true;

      logger.info(MODULE, 'Interceptor service initialized successfully');
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to initialize interceptor service', { error: error.message });
      return false;
    }
  }

  async shutdown() {
    try {
      await syncEngine.safeShutdown();
      offlineQueueManager.close();
      this.initialized = false;
      logger.info(MODULE, 'Interceptor service shut down');
    } catch (error) {
      logger.error(MODULE, 'Error shutting down interceptor service', { error: error.message });
    }
  }

  setOnlineStatus(isOnline) {
    httpInterceptor.setOnlineStatus(isOnline);

    if (isOnline) {
      syncEngine.forceSync();
    }
  }

  async interceptRequest(method, url, options = {}) {
    try {
      return await httpInterceptor.executeRequest(method, url, options);
    } catch (error) {
      logger.error(MODULE, 'Request interception failed', {
        method,
        url,
        error: error.message,
      });
      throw error;
    }
  }

  setCredentials(token, secret) {
    return credentialStore.storeCredentials(token, secret);
  }

  getCredentials() {
    return credentialStore.getCredentials();
  }

  clearCredentials() {
    return credentialStore.clearCredentials();
  }

  getQueueStatus() {
    return offlineQueueManager.getQueueStats();
  }

  getQueuedRequests(limit = 50) {
    return offlineQueueManager.getQueuedRequests(limit);
  }

  removeRequest(id) {
    return offlineQueueManager.removeRequest(id);
  }

  clearOldRequests(days = 7) {
    return offlineQueueManager.clearOldRequests(days);
  }

  getSyncStatus() {
    return syncEngine.getSyncStatus();
  }

  forceSync() {
    syncEngine.forceSync();
  }

  registerConflictHook(resourceType, hookFn) {
    return conflictResolver.registerResolutionHook(resourceType, hookFn);
  }

  unregisterConflictHook(resourceType) {
    return conflictResolver.unregisterResolutionHook(resourceType);
  }

  getPendingConflicts(limit = 50) {
    return conflictResolver.getPendingConflicts(limit);
  }

  resolveConflict(conflictId, resolution) {
    return conflictResolver.resolveConflictManually(conflictId, resolution);
  }

  onSyncStateChanged(callback) {
    syncEngine.on('sync-state-changed', callback);
  }

  onSyncProgress(callback) {
    syncEngine.on('sync-progress', callback);
  }

  offSyncStateChanged(callback) {
    syncEngine.off('sync-state-changed', callback);
  }

  offSyncProgress(callback) {
    syncEngine.off('sync-progress', callback);
  }
}

export const interceptorService = new InterceptorService();
