/**
 * Example Usage of SQLite Data Layer
 * 
 * This file demonstrates how to use the SQLite data layer
 * in the POSAwesome Desktop application.
 */

import { DatabaseManager } from './database.js';
import { INVOICE_STATUS, SYNC_STATUS, QUEUE_STATUS } from './constants.js';

/**
 * Initialize Database
 */
export function initializeDatabase() {
  const dbManager = new DatabaseManager();
  dbManager.open();
  dbManager.initialize();
  return dbManager;
}

/**
 * Example: Create Invoice with Line Items
 */
export function createInvoiceWithItems(dbManager, invoiceData, items) {
  const repos = dbManager.createRepositories();

  // Use transaction for atomic operation
  const result = dbManager.transaction(() => {
    // Create invoice
    const invoice = {
      id: invoiceData.name,
      name: invoiceData.name,
      customer: invoiceData.customer,
      customer_name: invoiceData.customer_name,
      status: INVOICE_STATUS.DRAFT,
      doctype: 'Sales Invoice',
      posting_date: new Date().toISOString().split('T')[0],
      total_quantity: items.reduce((sum, item) => sum + item.qty, 0),
      base_total: items.reduce((sum, item) => sum + (item.qty * item.rate), 0),
      base_grand_total: items.reduce((sum, item) => sum + (item.qty * item.rate), 0),
      sync_status: SYNC_STATUS.PENDING,
      erpnext_data: JSON.stringify(invoiceData),
    };

    repos.invoices.create(invoice);

    // Create invoice items
    items.forEach((item, idx) => {
      repos.invoiceItems.create({
        id: `${invoice.id}-${idx}`,
        invoice_id: invoice.id,
        item_code: item.item_code,
        item_name: item.item_name,
        quantity: item.qty,
        rate: item.rate,
        amount: item.qty * item.rate,
        uom: 'Nos',
        erpnext_data: JSON.stringify(item),
      });
    });

    return invoice;
  });

  return result;
}

/**
 * Example: Queue Invoice for Sync
 */
export function queueInvoiceForSync(dbManager, invoiceId, operation = 'insert') {
  const repos = dbManager.createRepositories();
  const invoice = repos.invoices.findById(invoiceId);

  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  const request = {
    id: `sync_${invoiceId}_${Date.now()}`,
    request_type: operation,
    entity_type: 'invoice',
    entity_id: invoiceId,
    operation: operation,
    payload: invoice,
    status: QUEUE_STATUS.PENDING,
    priority: 5,
  };

  repos.queue.create(request);
  return request;
}

/**
 * Example: Process Sync Queue
 */
export async function processSyncQueue(dbManager, syncService) {
  const repos = dbManager.createRepositories();
  const pending = repos.queue.findPending({ limit: 10, priority: true });

  for (const request of pending) {
    try {
      // Mark as processing
      repos.queue.markAsProcessing(request.id);

      // Send to ERPNext
      const response = await syncService.sendRequest(request);

      // Mark as completed
      repos.queue.markAsCompleted(request.id, response);

      // Update sync status
      repos.invoices.updateSyncStatus(request.entity_id, SYNC_STATUS.SYNCED);

      console.log(`✓ Synced ${request.entity_type} ${request.entity_id}`);
    } catch (error) {
      repos.queue.incrementRetryCount(request.id);
      const queue = repos.queue.findById(request.id);

      if (queue.retry_count >= queue.max_retries) {
        repos.queue.markAsFailed(request.id, error.message);
        console.error(`✗ Failed after ${queue.retry_count} retries: ${request.entity_id}`);
      } else {
        console.warn(`⚠ Retry ${queue.retry_count}/${queue.max_retries}: ${request.entity_id}`);
      }
    }
  }
}

/**
 * Example: Handle Sync Conflict
 */
export function handleSyncConflict(dbManager, conflictType, entityType, entityId, localData, remoteData) {
  const repos = dbManager.createRepositories();

  // Log conflict
  const conflictLog = repos.conflicts.logConflict(
    conflictType,
    entityType,
    entityId,
    localData,
    remoteData,
    'Conflict detected during sync'
  );

  console.warn(`⚠ Conflict logged: ${conflictType} on ${entityType}/${entityId}`);

  return conflictLog;
}

/**
 * Example: Resolve Conflict Automatically
 */
export function resolveConflictAutomatically(dbManager, conflictId, resolveStrategy = 'remote-wins') {
  const repos = dbManager.createRepositories();
  const conflict = repos.conflicts.findById(conflictId);

  if (!conflict) {
    throw new Error(`Conflict ${conflictId} not found`);
  }

  let resolved;

  if (resolveStrategy === 'remote-wins') {
    resolved = conflict.remote_data;
  } else if (resolveStrategy === 'local-wins') {
    resolved = conflict.local_data;
  } else if (resolveStrategy === 'merge') {
    // Simple merge: local takes precedence for specific fields
    resolved = {
      ...conflict.remote_data,
      ...conflict.local_data,
    };
  }

  repos.conflicts.resolve(
    conflictId,
    resolved,
    resolveStrategy,
    'system',
    `Auto-resolved using ${resolveStrategy} strategy`
  );

  console.log(`✓ Conflict ${conflictId} resolved using ${resolveStrategy}`);

  return resolved;
}

/**
 * Example: Search and Filter Invoices
 */
export function searchInvoices(dbManager, filters = {}) {
  const repos = dbManager.createRepositories();

  let results = [];

  if (filters.customerId) {
    results = repos.invoices.findByCustomer(filters.customerId, {
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      status: filters.status,
    });
  } else if (filters.status) {
    results = repos.invoices.findAll({
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      orderBy: filters.orderBy || 'created_at DESC',
    });
    results = results.filter(inv => inv.status === filters.status);
  } else {
    results = repos.invoices.findAll({
      limit: filters.limit || 50,
      offset: filters.offset || 0,
      orderBy: filters.orderBy || 'created_at DESC',
    });
  }

  return results;
}

/**
 * Example: Search Customers
 */
export function searchCustomers(dbManager, query, limit = 20) {
  const repos = dbManager.createRepositories();
  return repos.customers.search(query, { limit });
}

/**
 * Example: Get Invoice with Items
 */
export function getInvoiceWithItems(dbManager, invoiceId) {
  const repos = dbManager.createRepositories();

  const invoice = repos.invoices.findById(invoiceId);
  if (!invoice) {
    return null;
  }

  const items = repos.invoiceItems.findByInvoiceId(invoiceId);

  return {
    ...invoice,
    items,
  };
}

/**
 * Example: Update Invoice Status
 */
export function updateInvoiceStatus(dbManager, invoiceId, newStatus) {
  const repos = dbManager.createRepositories();

  const invoice = repos.invoices.findById(invoiceId);
  if (!invoice) {
    throw new Error(`Invoice ${invoiceId} not found`);
  }

  repos.invoices.update(invoiceId, {
    status: newStatus,
    local_modified: true,
  });

  return repos.invoices.findById(invoiceId);
}

/**
 * Example: Delete Invoice with Items
 */
export function deleteInvoice(dbManager, invoiceId) {
  const repos = dbManager.createRepositories();

  const result = dbManager.transaction(() => {
    // Delete items first
    repos.invoiceItems.deleteByInvoiceId(invoiceId);

    // Delete invoice
    repos.invoices.delete(invoiceId);

    return true;
  });

  return result;
}

/**
 * Example: Sync Metadata Management
 */
export function manageSyncMetadata(dbManager) {
  const repos = dbManager.createRepositories();
  const syncMetaRepo = repos.syncMetadata;

  // Initialize metadata for invoice sync
  syncMetaRepo.initializeMetadata('invoices', 3600); // 1 hour interval
  syncMetaRepo.initializeMetadata('customers', 3600);

  // Get all metadata
  const allMetadata = syncMetaRepo.findAll();
  console.log('Sync Metadata:', allMetadata);

  // Check what needs sync
  const dueSyncs = syncMetaRepo.getAllDue();
  console.log('Due for sync:', dueSyncs);

  // Update after sync
  syncMetaRepo.updateLastSyncTime('invoices', new Date().toISOString(), 150);

  return allMetadata;
}

/**
 * Example: Database Maintenance
 */
export function performMaintenance(dbManager) {
  console.log('Starting database maintenance...');

  // Check integrity
  if (!dbManager.checkDatabaseIntegrity()) {
    console.warn('Database integrity check failed, attempting repair...');
    dbManager.repair();
  }

  // Get stats
  const stats = dbManager.getStats();
  console.log('Database Statistics:', stats);

  // Cleanup old conflicts
  const repos = dbManager.createRepositories();
  repos.conflicts.cleanupResolved(30); // Remove conflicts older than 30 days

  // Clear completed queue items
  repos.queue.deleteByStatus('completed');

  // Optimize database
  dbManager.vacuum();

  // Backup database
  const timestamp = new Date().toISOString().split('T')[0];
  dbManager.backup(`./backup/posawsome_${timestamp}.db`);

  console.log('Maintenance completed successfully');
}

/**
 * Example: Get Database Dashboard Stats
 */
export function getDashboardStats(dbManager) {
  const repos = dbManager.createRepositories();

  const stats = {
    invoices: {
      total: repos.invoices.count(),
      draft: repos.invoices.count({ status: 'Draft' }),
      submitted: repos.invoices.count({ status: 'Submitted' }),
      pending_sync: repos.invoices.count({ syncStatus: 'pending' }),
    },
    customers: {
      total: repos.customers.count(),
      active: repos.customers.count() - 0, // Would need disabled count
    },
    queue: {
      pending: repos.queue.count({ status: 'pending' }),
      processing: repos.queue.count({ status: 'processing' }),
      completed: repos.queue.count({ status: 'completed' }),
      failed: repos.queue.count({ status: 'failed' }),
    },
    conflicts: {
      pending: repos.conflicts.count({ status: 'pending' }),
      resolved: repos.conflicts.count({ status: 'resolved' }),
      rejected: repos.conflicts.count({ status: 'rejected' }),
    },
  };

  return stats;
}

/**
 * Example: Graceful Shutdown
 */
export function shutdownDatabase(dbManager) {
  try {
    // Process any remaining queue items
    const repos = dbManager.createRepositories();
    const processing = repos.queue.findByStatus('processing');

    if (processing.length > 0) {
      console.log(`Warning: ${processing.length} items still processing`);
      // Could implement a timeout and fail them
    }

    // Close database connection
    dbManager.close();
    console.log('Database closed successfully');
  } catch (error) {
    console.error('Error during shutdown:', error.message);
    throw error;
  }
}

// Export for use in main application
export default {
  initializeDatabase,
  createInvoiceWithItems,
  queueInvoiceForSync,
  processSyncQueue,
  handleSyncConflict,
  resolveConflictAutomatically,
  searchInvoices,
  searchCustomers,
  getInvoiceWithItems,
  updateInvoiceStatus,
  deleteInvoice,
  manageSyncMetadata,
  performMaintenance,
  getDashboardStats,
  shutdownDatabase,
};
