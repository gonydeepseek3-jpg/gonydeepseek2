/**
 * Offline Interceptor Service
 * 
 * Intercepts HTTP requests from POSAwesome and handles offline scenarios
 * by queuing requests and syncing when connection is restored.
 */

import { QUEUE_STATUS } from '../db/constants.js';

export class OfflineInterceptor {
  constructor(dbManager) {
    this.dbManager = dbManager;
    this.queueRepo = null;
    this.isOnline = navigator.onLine;
    this.requestInterceptors = [];
    this.responseInterceptors = [];
    this.pendingSyncCallbacks = [];
  }

  initialize() {
    this.queueRepo = this.dbManager.createRepositories().queue;
    this.setupNetworkListeners();
  }

  setupNetworkListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOffline() {
    console.warn('Network connection lost, entering offline mode');
    this.isOnline = false;
    this.notifyOfflineMode();
  }

  handleOnline() {
    console.log('Network connection restored, syncing queued requests');
    this.isOnline = true;
    this.notifyOnlineMode();
    this.triggerPendingSync();
  }

  /**
   * Intercept request - queue if offline, send if online
   */
  async interceptRequest(config) {
    if (!this.isOnline) {
      return this.queueRequest(config);
    }

    try {
      const response = await this.performRequest(config);
      return { status: 200, data: response };
    } catch (error) {
      if (this.isNetworkError(error)) {
        console.warn('Network error detected, queueing request');
        this.isOnline = false;
        return this.queueRequest(config);
      }
      throw error;
    }
  }

  /**
   * Queue request for later sync
   */
  queueRequest(config) {
    const requestId = this.generateRequestId();

    const queueEntry = {
      id: requestId,
      entity_type: this.extractEntityType(config),
      entity_id: this.extractEntityId(config),
      operation: this.extractOperation(config),
      request_type: this.extractRequestType(config),
      payload: config.data || {},
      status: QUEUE_STATUS.PENDING,
      priority: this.extractPriority(config),
      retry_count: 0,
      max_retries: 3,
    };

    try {
      this.queueRepo.create(queueEntry);
      console.log(`✓ Queued request: ${requestId}`);

      return {
        status: 202, // Accepted - request will be processed
        data: {
          queued: true,
          requestId,
          message: 'Request queued for sync when connection is restored',
        },
      };
    } catch (error) {
      console.error('Failed to queue request:', error);
      throw error;
    }
  }

  /**
   * Perform actual HTTP request
   */
  async performRequest(config) {
    const url = config.url || '';
    const method = config.method || 'GET';
    const data = config.data;
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    const options = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = typeof data === 'string' ? data : JSON.stringify(data);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if error is network-related
   */
  isNetworkError(error) {
    return (
      error.message.includes('Network') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('timeout') ||
      error instanceof TypeError
    );
  }

  /**
   * Extract metadata from request config
   */
  extractEntityType(config) {
    const url = config.url || '';
    if (url.includes('/api/resource/Sales%20Invoice')) {
      return 'invoice';
    }
    if (url.includes('/api/resource/Customer')) {
      return 'customer';
    }
    return 'unknown';
  }

  extractEntityId(config) {
    const url = config.url || '';
    const parts = url.split('/');
    return parts[parts.length - 1] || 'unknown';
  }

  extractOperation(config) {
    const method = (config.method || 'GET').toUpperCase();
    if (method === 'POST') return 'insert';
    if (method === 'PUT' || method === 'PATCH') return 'update';
    if (method === 'DELETE') return 'delete';
    return 'read';
  }

  extractRequestType(config) {
    const method = (config.method || 'GET').toUpperCase();
    if (method === 'POST') return 'create';
    if (method === 'PUT' || method === 'PATCH') return 'update';
    if (method === 'DELETE') return 'delete';
    return 'read';
  }

  extractPriority(config) {
    // Higher priority for updates/deletes, lower for reads
    const operation = this.extractOperation(config);
    if (operation === 'delete') return 10;
    if (operation === 'update') return 8;
    if (operation === 'insert') return 7;
    return 5;
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    const pending = this.queueRepo.count({ status: QUEUE_STATUS.PENDING });
    const processing = this.queueRepo.count({ status: QUEUE_STATUS.PROCESSING });
    const failed = this.queueRepo.count({ status: QUEUE_STATUS.FAILED });
    const completed = this.queueRepo.count({ status: QUEUE_STATUS.COMPLETED });

    return {
      isOnline: this.isOnline,
      pending,
      processing,
      failed,
      completed,
      total: pending + processing + failed + completed,
    };
  }

  /**
   * Get pending requests
   */
  getPendingRequests(limit = 50) {
    return this.queueRepo.findPending({ limit });
  }

  /**
   * Register callback for sync completion
   */
  onPendingSync(callback) {
    this.pendingSyncCallbacks.push(callback);
  }

  /**
   * Trigger pending sync
   */
  triggerPendingSync() {
    this.pendingSyncCallbacks.forEach(callback => {
      try {
        callback(this.getQueueStatus());
      } catch (error) {
        console.error('Error in pending sync callback:', error);
      }
    });
  }

  /**
   * Notify UI of offline mode
   */
  notifyOfflineMode() {
    if (window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('offline-mode', {
          detail: { offline: true, timestamp: Date.now() },
        })
      );
    }
  }

  /**
   * Notify UI of online mode
   */
  notifyOnlineMode() {
    if (window.dispatchEvent) {
      window.dispatchEvent(
        new CustomEvent('online-mode', {
          detail: { online: true, timestamp: Date.now() },
        })
      );
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear completed requests from queue
   */
  clearCompletedRequests() {
    const result = this.queueRepo.deleteByStatus(QUEUE_STATUS.COMPLETED);
    console.log(`Cleared ${result.changes} completed requests`);
    return result;
  }

  /**
   * Retry failed requests
   */
  getRetryableRequests(maxRetries = 3) {
    return this.queueRepo.getRetryableFailed(maxRetries);
  }

  /**
   * Get request by ID
   */
  getRequest(requestId) {
    return this.queueRepo.findById(requestId);
  }

  /**
   * Cancel pending request
   */
  cancelRequest(requestId) {
    const request = this.queueRepo.findById(requestId);
    if (request && request.status === QUEUE_STATUS.PENDING) {
      return this.queueRepo.delete(requestId);
    }
    return { changes: 0 };
  }

  /**
   * Get request history for entity
   */
  getEntityRequestHistory(entityType, entityId) {
    return this.queueRepo.findByEntity(entityType, entityId);
  }

  /**
   * Export queue as JSON for debugging
   */
  exportQueueJson() {
    const requests = this.queueRepo.findAll({ limit: 10000 });
    return {
      exported_at: new Date().toISOString(),
      is_online: this.isOnline,
      requests: requests.map(req => ({
        id: req.id,
        entity: `${req.entity_type}/${req.entity_id}`,
        operation: req.operation,
        status: req.status,
        retries: `${req.retry_count}/${req.max_retries}`,
        created: req.created_at,
      })),
    };
  }
}

// Helper for intercepting XMLHttpRequest
export function interceptXMLHttpRequest(offlineInterceptor) {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...args) {
    this._method = method;
    this._url = url;
    return originalOpen.apply(this, [method, url, ...args]);
  };

  XMLHttpRequest.prototype.send = function(data) {
    const config = {
      method: this._method,
      url: this._url,
      data,
    };

    // Try to intercept if offline
    if (!navigator.onLine) {
      const response = offlineInterceptor.queueRequest(config);
      // Simulate response for the application
      this.status = response.status;
      this.responseText = JSON.stringify(response.data);
      if (this.onload) {
        this.onload();
      }
      return;
    }

    return originalSend.apply(this, [data]);
  };
}

// Helper for intercepting fetch
export function interceptFetch(offlineInterceptor) {
  window.fetch = async function(resource, init) {
    const config = {
      method: init?.method || 'GET',
      url: typeof resource === 'string' ? resource : resource.url,
      data: init?.body,
      headers: init?.headers,
    };

    const response = await offlineInterceptor.interceptRequest(config);

    // Create a Response-like object
    return {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      json: async () => response.data,
      text: async () => JSON.stringify(response.data),
    };
  };
}

export default OfflineInterceptor;
