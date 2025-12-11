/**
 * Sync Engine Service
 * 
 * Manages synchronization with ERPNext backend including:
 * - Queue processing
 * - Conflict resolution
 * - Retry logic
 * - Sync metadata tracking
 */

import { SYNC_STATUS, QUEUE_STATUS, CONFLICT_TYPE } from '../db/constants.js';

export class SyncEngine {
  constructor(dbManager, config = {}) {
    this.dbManager = dbManager;
    this.config = {
      erpnextBaseUrl: config.erpnextBaseUrl || process.env.ERPNEXT_BASE_URL || 'http://localhost:8000',
      apiToken: config.apiToken || process.env.ERPNEXT_API_TOKEN,
      apiSecret: config.apiSecret || process.env.ERPNEXT_API_SECRET,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      batchSize: config.batchSize || 50,
      syncInterval: config.syncInterval || 60000,
      ...config,
    };

    this.repos = null;
    this.isSyncing = false;
    this.syncCallbacks = [];
    this.lastSyncError = null;
  }

  initialize() {
    this.repos = this.dbManager.createRepositories();
    this.initializeSyncMetadata();
  }

  initializeSyncMetadata() {
    const syncMetaRepo = this.repos.syncMetadata;
    syncMetaRepo.initializeMetadata('invoices', this.config.syncInterval / 1000);
    syncMetaRepo.initializeMetadata('customers', this.config.syncInterval / 1000);
  }

  /**
   * Start sync cycle
   */
  async startSyncCycle() {
    if (this.isSyncing) {
      console.warn('Sync cycle already in progress');
      return { syncing: true };
    }

    this.isSyncing = true;
    const startTime = Date.now();

    try {
      const results = {
        invoices: await this.syncEntity('invoices'),
        customers: await this.syncEntity('customers'),
        queue: await this.processQueue(),
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        success: true,
      };

      this.notifySyncComplete(results);
      return results;
    } catch (error) {
      this.lastSyncError = error;
      const errorResult = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
      };

      this.notifySyncError(errorResult);
      return errorResult;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync specific entity type (invoices or customers)
   */
  async syncEntity(entityType) {
    console.log(`🔄 Syncing ${entityType}...`);
    const syncMetaRepo = this.repos.syncMetadata;
    const metadata = syncMetaRepo.findByEntityType(entityType);

    if (!metadata || !metadata.is_initial_sync_done) {
      return this.performInitialSync(entityType);
    }

    return this.performIncrementalSync(entityType, metadata);
  }

  /**
   * Perform initial sync
   */
  async performInitialSync(entityType) {
    console.log(`📥 Performing initial sync for ${entityType}`);

    try {
      const data = await this.fetchFromERPNext(entityType, { limit: 500 });

      if (!data || !data.data) {
        return { synced: 0, error: 'No data received' };
      }

      const repo = this.getRepository(entityType);
      let synced = 0;

      for (const record of data.data) {
        try {
          repo.upsert(record);
          synced++;
        } catch (error) {
          console.error(`Failed to sync ${entityType} record:`, error);
        }
      }

      // Update metadata
      const syncMetaRepo = this.repos.syncMetadata;
      syncMetaRepo.markInitialSyncDone(entityType);
      syncMetaRepo.updateLastSyncTime(entityType, new Date().toISOString(), synced);

      console.log(`✓ Initial sync complete: ${synced} ${entityType}`);
      return { synced, initial: true };
    } catch (error) {
      console.error(`Initial sync failed for ${entityType}:`, error);
      return { synced: 0, error: error.message };
    }
  }

  /**
   * Perform incremental sync
   */
  async performIncrementalSync(entityType, metadata) {
    console.log(`🔄 Performing incremental sync for ${entityType}`);

    try {
      const filters = metadata.last_sync_time
        ? { filters: [['modified', '>', metadata.last_sync_time]] }
        : {};

      const data = await this.fetchFromERPNext(entityType, filters);

      if (!data || !data.data) {
        return { synced: 0 };
      }

      const repo = this.getRepository(entityType);
      const conflictRepo = this.repos.conflicts;
      let synced = 0;
      let conflicts = 0;

      for (const record of data.data) {
        try {
          const existing = repo.findById(record.name);

          if (existing && this.hasConflict(existing, record)) {
            conflicts++;
            conflictRepo.logConflict(
              CONFLICT_TYPE.VERSION_MISMATCH,
              entityType,
              record.name,
              existing,
              record,
              'Version mismatch during incremental sync'
            );
            // Keep local version
            continue;
          }

          repo.upsert(record);
          synced++;
        } catch (error) {
          console.error(`Failed to sync ${entityType} record:`, error);
        }
      }

      // Update metadata
      const syncMetaRepo = this.repos.syncMetadata;
      syncMetaRepo.updateLastSyncTime(entityType, new Date().toISOString(), synced);

      console.log(`✓ Incremental sync complete: ${synced} ${entityType} (${conflicts} conflicts)`);
      return { synced, conflicts };
    } catch (error) {
      console.error(`Incremental sync failed for ${entityType}:`, error);
      return { synced: 0, error: error.message };
    }
  }

  /**
   * Check if there's a conflict between local and remote
   */
  hasConflict(local, remote) {
    // If modified timestamps differ, there's a potential conflict
    if (local.erpnext_modified && remote.modified) {
      const localTime = new Date(local.erpnext_modified).getTime();
      const remoteTime = new Date(remote.modified).getTime();

      // If remote is older and we have local changes, it's a conflict
      if (remoteTime < localTime && local.local_modified) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process queued requests
   */
  async processQueue() {
    console.log('📤 Processing queued requests...');
    const queueRepo = this.repos.queue;

    const pending = queueRepo.findPending({ limit: this.config.batchSize, priority: true });

    if (pending.length === 0) {
      console.log('✓ Queue empty');
      return { processed: 0, completed: 0, failed: 0 };
    }

    let completed = 0;
    let failed = 0;

    for (const request of pending) {
      try {
        queueRepo.markAsProcessing(request.id);
        const response = await this.sendRequest(request);

        queueRepo.markAsCompleted(request.id, response);

        // Update entity sync status
        const repo = this.getRepository(request.entity_type);
        if (repo) {
          repo.updateSyncStatus(request.entity_id, SYNC_STATUS.SYNCED);
        }

        completed++;
        console.log(`✓ Processed: ${request.entity_type}/${request.entity_id}`);
      } catch (error) {
        failed++;
        queueRepo.incrementRetryCount(request.id);

        const updatedRequest = queueRepo.findById(request.id);
        if (updatedRequest.retry_count >= updatedRequest.max_retries) {
          queueRepo.markAsFailed(request.id, error.message);
          console.error(`✗ Failed after ${updatedRequest.retry_count} retries: ${request.entity_id}`);
        } else {
          console.warn(`⚠ Retry ${updatedRequest.retry_count}/${updatedRequest.max_retries}: ${request.entity_id}`);
        }
      }

      // Delay between requests
      await this.delay(100);
    }

    console.log(`✓ Queue processing complete: ${completed} completed, ${failed} failed`);
    return { processed: pending.length, completed, failed };
  }

  /**
   * Send request to ERPNext
   */
  async sendRequest(request) {
    const { entity_type, entity_id, operation, payload } = request;

    const url = `${this.config.erpnextBaseUrl}/api/method/frappe.client.${this.getMethod(operation)}`;

    const body = {
      doctype: this.getDoctype(entity_type),
      name: entity_id,
      ...payload,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`ERPNext API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Fetch data from ERPNext
   */
  async fetchFromERPNext(entityType, filters = {}) {
    const doctype = this.getDoctype(entityType);
    const url = new URL(
      `${this.config.erpnextBaseUrl}/api/resource/${encodeURIComponent(doctype)}`
    );

    url.searchParams.append('fields', JSON.stringify(['name', 'modified', '*']));
    url.searchParams.append('limit_page_length', '500');

    if (filters.filters) {
      url.searchParams.append('filters', JSON.stringify(filters.filters));
    }

    const response = await fetch(url.toString(), {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${entityType}: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get HTTP headers for ERPNext API
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.config.apiToken && this.config.apiSecret) {
      const token = Buffer.from(`${this.config.apiToken}:${this.config.apiSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${token}`;
    }

    return headers;
  }

  /**
   * Get REST method name
   */
  getMethod(operation) {
    if (operation === 'insert') return 'insert';
    if (operation === 'update') return 'set_value';
    if (operation === 'delete') return 'delete';
    return 'get';
  }

  /**
   * Get doctype for entity
   */
  getDoctype(entityType) {
    if (entityType === 'invoices') return 'Sales Invoice';
    if (entityType === 'customers') return 'Customer';
    if (entityType === 'invoice') return 'Sales Invoice';
    if (entityType === 'customer') return 'Customer';
    return entityType;
  }

  /**
   * Get repository for entity type
   */
  getRepository(entityType) {
    if (entityType === 'invoices' || entityType === 'invoice') {
      return this.repos.invoices;
    }
    if (entityType === 'customers' || entityType === 'customer') {
      return this.repos.customers;
    }
    return null;
  }

  /**
   * Get sync status
   */
  getSyncStatus() {
    const syncMetaRepo = this.repos.syncMetadata;
    const allMetadata = syncMetaRepo.findAll();

    return {
      isSyncing: this.isSyncing,
      lastError: this.lastSyncError,
      metadata: allMetadata.map(m => ({
        entity: m.entity_type,
        lastSync: m.last_sync_time,
        nextSync: m.next_sync_time,
        initialDone: m.is_initial_sync_done,
        totalSynced: m.total_synced_count,
      })),
    };
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    const invoiceCount = this.repos.invoices.count();
    const customerCount = this.repos.customers.count();
    const queueCount = this.repos.queue.count();
    const conflictCount = this.repos.conflicts.count();

    return {
      invoices: invoiceCount,
      customers: customerCount,
      queuedRequests: queueCount,
      unresolvedConflicts: conflictCount,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resolve conflict automatically
   */
  resolveConflict(conflictId, strategy = 'remote-wins') {
    const conflictRepo = this.repos.conflicts;
    const conflict = conflictRepo.findById(conflictId);

    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found`);
    }

    let resolved;
    if (strategy === 'remote-wins') {
      resolved = conflict.remote_data;
    } else if (strategy === 'local-wins') {
      resolved = conflict.local_data;
    } else {
      // Merge strategy
      resolved = {
        ...conflict.remote_data,
        ...conflict.local_data,
      };
    }

    conflictRepo.resolve(conflictId, resolved, strategy, 'sync_engine');
    console.log(`✓ Resolved conflict ${conflictId} using ${strategy}`);

    return resolved;
  }

  /**
   * Register sync callback
   */
  onSyncComplete(callback) {
    this.syncCallbacks.push(callback);
  }

  /**
   * Notify sync completion
   */
  notifySyncComplete(results) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback({ success: true, results });
      } catch (error) {
        console.error('Error in sync callback:', error);
      }
    });
  }

  /**
   * Notify sync error
   */
  notifySyncError(error) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback({ success: false, error });
      } catch (err) {
        console.error('Error in sync callback:', err);
      }
    });
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Manual trigger for full sync
   */
  async forceSyncAll() {
    console.log('🔄 Force syncing all entities...');
    const syncMetaRepo = this.repos.syncMetadata;

    // Reset sync metadata to force initial sync
    syncMetaRepo.findAll().forEach(m => {
      syncMetaRepo.update(m.id, { is_initial_sync_done: 0 });
    });

    return this.startSyncCycle();
  }

  /**
   * Get failed requests for manual review
   */
  getFailedRequests() {
    return this.repos.queue.findFailed({ limit: 100 });
  }

  /**
   * Manually retry failed request
   */
  async retryFailedRequest(requestId) {
    const request = this.repos.queue.findById(requestId);

    if (!request) {
      throw new Error(`Request ${requestId} not found`);
    }

    if (request.status !== QUEUE_STATUS.FAILED) {
      throw new Error(`Request is ${request.status}, not failed`);
    }

    // Reset retry count for manual retry
    this.repos.queue.update(requestId, {
      retry_count: 0,
      status: QUEUE_STATUS.PENDING,
      error_message: null,
    });

    return { retrying: true, requestId };
  }
}

export default SyncEngine;
