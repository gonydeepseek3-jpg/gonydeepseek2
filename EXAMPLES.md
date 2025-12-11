# POSAwesome Desktop - Code Examples

Practical examples for using POSAwesome Desktop services.

## Table of Contents

1. [Basic Initialization](#basic-initialization)
2. [Database Operations](#database-operations)
3. [Offline Scenarios](#offline-scenarios)
4. [Sync Management](#sync-management)
5. [Conflict Resolution](#conflict-resolution)
6. [Admin Dashboard](#admin-dashboard)
7. [Error Handling](#error-handling)
8. [Advanced Scenarios](#advanced-scenarios)

## Basic Initialization

### Simple Integration Setup

```javascript
import POSAwesomeIntegration from './src/integration.js';

// Initialize with defaults from environment
const posAwesome = new POSAwesomeIntegration({
  dashboardContainerId: 'admin-panel',
});

// Initialize all services
await posAwesome.initialize();

// Get status anytime
const status = posAwesome.getStatus();
console.log('System Status:', status);

// Shutdown on app close
window.addEventListener('beforeunload', () => {
  posAwesome.shutdown();
});
```

### Custom Configuration

```javascript
const posAwesome = new POSAwesomeIntegration({
  dbPath: '/custom/path/to/db.db',
  erpnextBaseUrl: 'https://erp.example.com',
  apiToken: 'token123',
  apiSecret: 'secret456',
  syncInterval: 30000, // 30 seconds
  dashboardContainerId: 'admin-panel',
});

await posAwesome.initialize();
```

## Database Operations

### Create Invoice

```javascript
const repos = posAwesome.getRepositories();

const invoice = repos.invoices.create({
  id: 'INV-2024-001',
  name: 'INV-2024-001',
  customer: 'CUST-001',
  customer_name: 'John Doe',
  status: 'Draft',
  doctype: 'Sales Invoice',
  posting_date: '2024-01-15',
  base_grand_total: 5000,
  sync_status: 'pending',
});

console.log('Invoice created:', invoice);
```

### Add Line Items to Invoice

```javascript
const invoiceId = 'INV-2024-001';
const items = [
  {
    id: `${invoiceId}-1`,
    invoice_id: invoiceId,
    item_code: 'ITEM-001',
    item_name: 'Product A',
    quantity: 2,
    rate: 1000,
    amount: 2000,
    uom: 'Nos',
  },
  {
    id: `${invoiceId}-2`,
    invoice_id: invoiceId,
    item_code: 'ITEM-002',
    item_name: 'Product B',
    quantity: 3,
    rate: 1000,
    amount: 3000,
    uom: 'Nos',
  },
];

repos.invoiceItems.bulkCreate(items);
console.log('Added items to invoice');
```

### Retrieve Invoice with Items

```javascript
const invoice = repos.invoices.findById('INV-2024-001');
const items = repos.invoiceItems.findByInvoiceId('INV-2024-001');

console.log('Invoice:', invoice);
console.log('Items:', items);

// Or use transaction for atomic operation
const fullInvoice = posAwesome.dbManager.transaction(() => {
  return {
    ...repos.invoices.findById('INV-2024-001'),
    items: repos.invoiceItems.findByInvoiceId('INV-2024-001'),
  };
});
```

### Search Customers

```javascript
// Find by name
const customer = repos.customers.findByName('CUST-001');

// Find by email
const byEmail = repos.customers.findByEmail('john@example.com');

// Search by text
const results = repos.customers.search('john', { limit: 20 });
console.log(`Found ${results.length} customers`);

// Count customers
const total = repos.customers.count();
console.log(`Total customers: ${total}`);
```

### Update Invoice Status

```javascript
repos.invoices.update('INV-2024-001', {
  status: 'Submitted',
  local_modified: true,
});

const updated = repos.invoices.findById('INV-2024-001');
console.log('Updated status:', updated.status);
```

## Offline Scenarios

### Monitor Queue Status

```javascript
const interceptor = posAwesome.offlineInterceptor;

// Check current status
const status = interceptor.getQueueStatus();
console.log(`Online: ${status.isOnline}`);
console.log(`Pending requests: ${status.pending}`);

// Listen for sync trigger
interceptor.onPendingSync((newStatus) => {
  console.log('Queue updated:', newStatus);
  updateUI(newStatus);
});
```

### Simulate Offline Work

```javascript
// Create invoice while offline
const repos = posAwesome.getRepositories();
repos.invoices.create({
  id: 'INV-OFFLINE-001',
  name: 'INV-OFFLINE-001',
  customer: 'CUST-001',
  status: 'Draft',
  sync_status: 'pending',
});

// Check what's queued
const pending = interceptor.getPendingRequests();
console.log(`${pending.length} requests queued`);

// When online, sync is automatic
// Or trigger manually
await posAwesome.triggerSync();
```

### View Queue Details

```javascript
const queued = interceptor.getPendingRequests(100);

queued.forEach(req => {
  console.log(`${req.entity_type}/${req.entity_id}: ${req.operation} (${req.status})`);
  if (req.error_message) {
    console.error(`  Error: ${req.error_message}`);
    console.log(`  Retries: ${req.retry_count}/${req.max_retries}`);
  }
});

// Export for debugging
const debugExport = interceptor.exportQueueJson();
console.log(JSON.stringify(debugExport, null, 2));
```

## Sync Management

### Manual Sync

```javascript
const syncEngine = posAwesome.syncEngine;

// Start sync cycle
const result = await syncEngine.startSyncCycle();
console.log('Sync result:', result);

// Check what was synced
console.log(`Invoices: ${result.invoices.synced}`);
console.log(`Customers: ${result.customers.synced}`);
console.log(`Queue processed: ${result.queue.completed}`);
```

### Force Full Resync

```javascript
// Reset sync metadata and re-fetch everything
const result = await syncEngine.forceSyncAll();
console.log('Full sync complete:', result);
```

### Monitor Sync Status

```javascript
const syncStatus = syncEngine.getSyncStatus();
console.log('Sync Status:');
console.log(`  Is syncing: ${syncStatus.isSyncing}`);
console.log(`  Last error: ${syncStatus.lastError?.message}`);

syncStatus.metadata.forEach(m => {
  console.log(`\n${m.entity}:`);
  console.log(`  Last sync: ${m.lastSync}`);
  console.log(`  Next sync: ${m.nextSync}`);
  console.log(`  Initial sync done: ${m.initialDone}`);
  console.log(`  Total synced: ${m.totalSynced}`);
});
```

### Get Sync Statistics

```javascript
const stats = syncEngine.getSyncStats();
console.log('Database Statistics:');
console.log(`  Invoices: ${stats.invoices}`);
console.log(`  Customers: ${stats.customers}`);
console.log(`  Queued requests: ${stats.queuedRequests}`);
console.log(`  Unresolved conflicts: ${stats.unresolvedConflicts}`);
```

## Conflict Resolution

### View Unresolved Conflicts

```javascript
const repos = posAwesome.getRepositories();
const conflicts = repos.conflicts.getUnresolvedConflicts();

console.log(`${conflicts.length} unresolved conflicts:`);

conflicts.forEach(c => {
  console.log(`\nConflict: ${c.id}`);
  console.log(`  Entity: ${c.entity_type}/${c.entity_id}`);
  console.log(`  Type: ${c.conflict_type}`);
  console.log(`  Local version:`, c.local_data);
  console.log(`  Remote version:`, c.remote_data);
});
```

### Automatic Resolution

```javascript
const syncEngine = posAwesome.syncEngine;

// Resolve using remote version (server wins)
syncEngine.resolveConflict(conflictId, 'remote-wins');

// Resolve using local version (client wins)
syncEngine.resolveConflict(conflictId, 'local-wins');

// Resolve with merge
syncEngine.resolveConflict(conflictId, 'merge');
```

### Manual Resolution

```javascript
const conflictRepo = repos.conflicts;
const conflict = conflictRepo.findById(conflictId);

// Create merged version
const merged = {
  ...conflict.remote_data,
  customer_name: conflict.local_data.customer_name, // Prefer local name
  base_grand_total: conflict.remote_data.base_grand_total, // Use remote total
};

// Resolve with merged data
conflictRepo.resolve(
  conflictId,
  merged,
  'custom_merge',
  'user@example.com',
  'Merged customer name from local, total from remote'
);
```

## Admin Dashboard

### Initialize Dashboard

```javascript
import AdminDashboard from './src/renderer/js/adminDashboard.js';

const dashboard = new AdminDashboard(
  'admin-panel', // Container ID
  posAwesome.dbManager,
  posAwesome.syncEngine,
  posAwesome.offlineInterceptor
);

dashboard.initialize();

// Show/hide
dashboard.toggleVisibility();

// Cleanup on shutdown
window.addEventListener('beforeunload', () => {
  dashboard.destroy();
});
```

### Programmatic Dashboard Control

```javascript
const dashboard = posAwesome.adminDashboard;

// Refresh dashboard
dashboard.refresh();

// Switch tabs
dashboard.switchTab('queue');
dashboard.switchTab('conflicts');
dashboard.switchTab('dashboard');

// Trigger sync from dashboard
dashboard.handleStartSync(); // User button click equivalent
```

## Error Handling

### Database Error Handling

```javascript
try {
  posAwesome.dbManager.initialize();
} catch (error) {
  console.error('Database initialization failed:', error);

  // Check integrity
  if (!posAwesome.dbManager.checkDatabaseIntegrity()) {
    console.log('Database corruption detected, attempting repair...');
    posAwesome.dbManager.repair();
  }

  // If repair fails, restore from backup
  try {
    posAwesome.dbManager.restoreFromBackup('./backup/posawsome_latest.db');
    console.log('Restored from backup');
  } catch (restoreError) {
    console.error('Restore failed:', restoreError);
  }
}
```

### Sync Error Handling

```javascript
posAwesome.syncEngine.onSyncComplete((result) => {
  if (!result.success) {
    const error = result.error;
    console.error('Sync failed:', error.message);

    // Handle specific errors
    if (error.message.includes('Network')) {
      console.log('Network error - will retry when online');
    } else if (error.message.includes('Authentication')) {
      console.log('Auth error - check credentials');
    } else if (error.message.includes('Conflict')) {
      console.log('Conflicts detected - check conflicts tab');
    }
  }
});
```

### Queue Error Handling

```javascript
const failed = posAwesome.syncEngine.getFailedRequests();

failed.forEach(req => {
  console.log(`Failed: ${req.id}`);
  console.log(`  Error: ${req.error_message}`);
  console.log(`  Retries: ${req.retry_count}/${req.max_retries}`);

  // Manually retry specific request
  if (req.retry_count < 2) {
    posAwesome.syncEngine.retryFailedRequest(req.id)
      .then(() => console.log('Retrying...'))
      .catch(err => console.error('Retry failed:', err));
  }
});
```

## Advanced Scenarios

### Batch Processing with Transactions

```javascript
const repos = posAwesome.getRepositories();

// Multiple operations atomically
posAwesome.dbManager.transaction(() => {
  // Create customer
  const customer = repos.customers.create({
    id: 'CUST-BULK-001',
    name: 'CUST-BULK-001',
    customer_name: 'Bulk Customer',
  });

  // Create invoices for customer
  for (let i = 1; i <= 10; i++) {
    repos.invoices.create({
      id: `INV-BULK-${i}`,
      name: `INV-BULK-${i}`,
      customer: 'CUST-BULK-001',
      status: 'Draft',
    });
  }

  // If any operation fails, all are rolled back
});
```

### Custom Sync Schedule

```javascript
// Override default sync interval
const customSync = setInterval(async () => {
  if (navigator.onLine) {
    const result = await posAwesome.triggerSync();
    
    if (result.success) {
      console.log('✓ Sync successful');
    } else {
      console.error('✗ Sync failed:', result.error);
    }
  }
}, 30000); // 30 seconds

// Clean up
window.addEventListener('beforeunload', () => {
  clearInterval(customSync);
});
```

### Real-time Status Widget

```javascript
// Update UI every second with current status
setInterval(() => {
  const status = posAwesome.getStatus();
  const queue = posAwesome.getQueueStatus();
  const stats = posAwesome.getSyncStats();

  document.getElementById('network-status').textContent = 
    queue.isOnline ? '🟢 Online' : '🔴 Offline';

  document.getElementById('sync-status').textContent = 
    status.sync.isSyncing ? '🔄 Syncing...' : '✓ Ready';

  document.getElementById('queue-count').textContent = 
    `📤 ${queue.pending}`;

  document.getElementById('conflicts-count').textContent = 
    `⚠️ ${stats.unresolvedConflicts}`;
}, 1000);
```

### Export Data for Analysis

```javascript
// Export all data as JSON for analysis
async function exportAllData() {
  const repos = posAwesome.getRepositories();

  const export_data = {
    exported_at: new Date().toISOString(),
    invoices: repos.invoices.findAll({ limit: 10000 }),
    customers: repos.customers.findAll({ limit: 10000 }),
    queue: repos.queue.findAll({ limit: 10000 }),
    conflicts: repos.conflicts.findAll({ limit: 10000 }),
    stats: posAwesome.getSyncStats(),
    debug: posAwesome.exportDebugInfo(),
  };

  // Download as JSON
  const blob = new Blob([JSON.stringify(export_data, null, 2)], 
    { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `posawsome_export_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
```

### System Health Check

```javascript
async function performHealthCheck() {
  console.log('🏥 Running health check...\n');

  const status = posAwesome.getStatus();
  const queue = posAwesome.getQueueStatus();
  const stats = posAwesome.getSyncStats();

  const report = {
    database: {
      connected: status.database.connected,
      stats: status.database.stats,
      integrity: posAwesome.dbManager.checkDatabaseIntegrity(),
    },
    network: {
      online: status.network.online,
    },
    sync: {
      syncing: status.sync.isSyncing,
      lastError: status.sync.lastError,
    },
    queue: {
      pending: queue.pending,
      processing: queue.processing,
      failed: queue.failed,
      completed: queue.completed,
    },
    data: stats,
    health: {
      healthy: status.database.connected && 
               queue.failed === 0 && 
               status.sync.lastError === null,
    },
  };

  console.log('📋 Health Check Report:');
  console.log(JSON.stringify(report, null, 2));

  return report;
}
```

---

For more information, see:
- [SETUP.md](./SETUP.md) - Installation and configuration
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Developer guide
- [src/db/README.md](./src/db/README.md) - Database documentation
