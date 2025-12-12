import { offlineQueueManager } from './offlineQueueManager.js';
import { httpInterceptor } from './httpInterceptor.js';
import { logger } from './logger.js';

const MODULE = 'RequestProcessor';

class RequestProcessor {
  constructor() {
    this.processingInterval = parseInt(process.env.PROCESSING_INTERVAL || '5000');
    this.isProcessing = false;
    this.processor = null;
  }

  start() {
    if (this.processor) return;

    logger.info(MODULE, 'Starting request processor', { interval: this.processingInterval });

    this.processor = setInterval(() => {
      this.processQueue();
    }, this.processingInterval);
  }

  stop() {
    if (this.processor) {
      clearInterval(this.processor);
      this.processor = null;
      logger.info(MODULE, 'Request processor stopped');
    }
  }

  async processQueue() {
    if (this.isProcessing || !httpInterceptor.isOnline) {
      return;
    }

    this.isProcessing = true;

    try {
      const requests = offlineQueueManager.getQueuedRequests(10, 'pending');

      if (requests.length === 0) {
        this.isProcessing = false;
        return;
      }

      logger.debug(MODULE, 'Processing queued requests', { count: requests.length });

      for (const request of requests) {
        await this.processRequest(request);
      }
    } catch (error) {
      logger.error(MODULE, 'Error during queue processing', { error: error.message });
    } finally {
      this.isProcessing = false;
    }
  }

  async processRequest(request) {
    const maxRetries = parseInt(process.env.MAX_RETRIES || '3');

    try {
      logger.debug(MODULE, 'Processing request', {
        id: request.id,
        method: request.method,
        url: request.url,
      });

      const response = await httpInterceptor.executeRequest(request.method, request.url, {
        headers: request.headers,
        body: request.body,
      });

      if (response.ok) {
        offlineQueueManager.updateRequestStatus(request.id, 'completed');
        logger.info(MODULE, 'Request processed successfully', { id: request.id });
      } else if (request.retry_count >= maxRetries) {
        offlineQueueManager.updateRequestStatus(request.id, 'failed', 'Max retries exceeded');
        logger.warn(MODULE, 'Request failed after max retries', { id: request.id });
      } else {
        offlineQueueManager.incrementRetryCount(request.id);
        logger.warn(MODULE, 'Request processing failed, will retry', {
          id: request.id,
          retryCount: request.retry_count + 1,
        });
      }
    } catch (error) {
      if (request.retry_count >= maxRetries) {
        offlineQueueManager.updateRequestStatus(request.id, 'failed', error.message);
        logger.error(MODULE, 'Request processing failed permanently', {
          id: request.id,
          error: error.message,
        });
      } else {
        offlineQueueManager.incrementRetryCount(request.id);
        logger.warn(MODULE, 'Request processing error, will retry', {
          id: request.id,
          error: error.message,
        });
      }
    }
  }

  getQueueStatus() {
    return offlineQueueManager.getQueueStats();
  }
}

export const requestProcessor = new RequestProcessor();
