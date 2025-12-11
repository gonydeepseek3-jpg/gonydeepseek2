import { offlineQueueManager } from './offlineQueueManager.js';
import { httpInterceptor } from './httpInterceptor.js';
import { credentialStore } from './credentialStore.js';
import { requestProcessor } from './requestProcessor.js';
import { logger } from './logger.js';

const MODULE = 'InterceptorService';

class InterceptorService {
  constructor() {
    this.initialized = false;
  }

  initialize() {
    try {
      if (this.initialized) return true;

      logger.info(MODULE, 'Initializing interceptor service');

      if (!offlineQueueManager.initialize()) {
        logger.error(MODULE, 'Failed to initialize offline queue manager');
        return false;
      }

      requestProcessor.start();
      this.initialized = true;

      logger.info(MODULE, 'Interceptor service initialized successfully');
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to initialize interceptor service', { error: error.message });
      return false;
    }
  }

  shutdown() {
    try {
      requestProcessor.stop();
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
      requestProcessor.processQueue();
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
    return requestProcessor.getQueueStatus();
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
}

export const interceptorService = new InterceptorService();
