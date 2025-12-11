# SQLite Data Layer

A comprehensive local data persistence layer for POSAwesome Desktop using SQLite with better-sqlite3. This module provides schema definitions, migrations, CRUD operations, serialization/deserialization, and error handling.

## Features

- **Local SQLite Database**: Efficient local data storage using better-sqlite3
- **Complete Schema**: Tables for invoices, line items, customers, queue, sync metadata, and conflict logs
- **Migration System**: Automatic schema initialization and versioning
- **CRUD Operations**: Full Create, Read, Update, Delete helpers for all entities
- **Serialization**: Convert between ERPNext payloads and database records
- **Sync Management**: Track sync status, metadata, and conflict resolution
- **Error Handling**: Database integrity checks, repair utilities, and recovery mechanisms
- **Transaction Support**: ACID-compliant operations with transaction helpers
- **Indexes**: Performance optimization with strategic database indexes

## Project Structure

```
src/db/
├── database.js                    # DatabaseManager and core utilities
├── schema.js                      # Table schemas and SQL generation
├── migrations.js                  # Migration system
├── serialization.js               # Serialization/deserialization utilities
├── constants.js                   # Constants and enums
├── repositories/
│   ├── invoiceRepository.js       # Invoice CRUD operations
│   ├── invoiceItemRepository.js   # Invoice line items CRUD
│   ├── customerRepository.js      # Customer CRUD operations
│   ├── queueRepository.js         # Queue management
│   ├── syncMetadataRepository.js  # Sync tracking
│   └── conflictLogRepository.js   # Conflict resolution tracking
└── __tests__/
    ├── database.test.js           # Unit tests
    └── smoke.test.js              # Smoke tests
```

## Database Tables

### Invoices
Stores sales invoices with ERPNext compatibility.

```sql
CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  doctype TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  customer TEXT NOT NULL,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT "Draft",
  posting_date TEXT,
  due_date TEXT,
  total_quantity REAL DEFAULT 0,
  base_total REAL DEFAULT 0,
  base_grand_total REAL DEFAULT 0,
  outstanding_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  remarks TEXT,
  erpnext_data TEXT,              -- Full ERPNext payload (JSON)
  sync_status TEXT NOT NULL DEFAULT "pending",
  local_modified INTEGER DEFAULT 0,
  erpnext_modified TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes**:
- idx_invoices_customer
- idx_invoices_status
- idx_invoices_sync_status
- idx_invoices_created_at

### Invoice Items
Line items within invoices.

```sql
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  item_name TEXT,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  stock_qty REAL DEFAULT 0,
  uom TEXT,
  rate REAL NOT NULL DEFAULT 0,
  amount REAL DEFAULT 0,
  discount_percentage REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  serial_number TEXT,
  batch_no TEXT,
  warehouse TEXT,
  erpnext_data TEXT,              -- Full ERPNext item payload (JSON)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Customers
Customer master data.

```sql
CREATE TABLE customers (
  id TEXT PRIMARY KEY,
  doctype TEXT NOT NULL,
  name TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  email TEXT,
  phone TEXT,
  mobile_no TEXT,
  customer_group TEXT,
  territory TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  pincode TEXT,
  credit_limit REAL DEFAULT 0,
  outstanding_amount REAL DEFAULT 0,
  disabled INTEGER DEFAULT 0,
  erpnext_data TEXT,              -- Full ERPNext payload (JSON)
  sync_status TEXT NOT NULL DEFAULT "pending",
  erpnext_modified TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Queued Requests
Request queue for sync operations.

```sql
CREATE TABLE queued_requests (
  id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL,     -- create, update, delete
  entity_type TEXT NOT NULL,      -- invoice, customer
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,        -- insert, update, delete
  payload TEXT NOT NULL,          -- Request payload (JSON)
  status TEXT NOT NULL DEFAULT "pending",
  priority INTEGER DEFAULT 5,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  response_data TEXT,             -- Server response (JSON)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);
```

### Sync Metadata
Tracks synchronization state and progress.

```sql
CREATE TABLE sync_metadata (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL UNIQUE,
  last_sync_time DATETIME,
  sync_token TEXT,
  last_sync_count INTEGER DEFAULT 0,
  total_synced_count INTEGER DEFAULT 0,
  is_initial_sync_done INTEGER DEFAULT 0,
  next_sync_time DATETIME,
  sync_interval_seconds INTEGER DEFAULT 3600,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Conflict Logs
Tracks data conflicts and resolution.

```sql
CREATE TABLE conflict_logs (
  id TEXT PRIMARY KEY,
  conflict_type TEXT NOT NULL,    -- version_mismatch, concurrent_edit, etc.
  entity_type TEXT NOT NULL,      -- invoice, customer
  entity_id TEXT NOT NULL,
  local_data TEXT,                -- Local version (JSON)
  remote_data TEXT,               -- Remote version (JSON)
  merged_data TEXT,               -- Resolved version (JSON)
  resolution_status TEXT DEFAULT "pending",
  resolution_method TEXT,
  resolved_by TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME
);
```

## Usage

### Initialization

```javascript
import { DatabaseManager } from './src/db/database.js';

const dbManager = new DatabaseManager();
dbManager.open();
dbManager.initialize();

const repos = dbManager.createRepositories();
```

### Invoice Operations

```javascript
const repos = dbManager.createRepositories();
const invoiceRepo = repos.invoices;

// Create
const result = invoiceRepo.create({
  id: 'INV-001',
  name: 'INV-001',
  customer: 'CUST-001',
  status: 'Draft',
  base_grand_total: 5000
});

// Read
const invoice = invoiceRepo.findById('INV-001');

// Update
invoiceRepo.update('INV-001', { status: 'Submitted' });

// Delete
invoiceRepo.delete('INV-001');

// Find by customer
const customerInvoices = invoiceRepo.findByCustomer('CUST-001');

// Count
const total = invoiceRepo.count({ status: 'Draft' });

// Sync operations
invoiceRepo.updateSyncStatus('INV-001', 'synced');
invoiceRepo.updateLocalModified('INV-001', true);

// Upsert
invoiceRepo.upsert(invoice);
```

### Customer Operations

```javascript
const customerRepo = repos.customers;

// Create
customerRepo.create({
  id: 'CUST-001',
  name: 'CUST-001',
  customer_name: 'John Doe',
  email: 'john@example.com'
});

// Search
const results = customerRepo.search('john');

// Find by email
const customer = customerRepo.findByEmail('john@example.com');

// Disable/Enable
customerRepo.disable('CUST-001');
customerRepo.enable('CUST-001');
```

### Queue Operations

```javascript
const queueRepo = repos.queue;

// Create request
queueRepo.create({
  id: 'REQ-001',
  entity_type: 'invoice',
  entity_id: 'INV-001',
  operation: 'insert',
  payload: { /* data */ }
});

// Find pending
const pending = queueRepo.findPending();

// Mark as processing
queueRepo.markAsProcessing('REQ-001');

// Mark as completed
queueRepo.markAsCompleted('REQ-001', { success: true });

// Mark as failed
queueRepo.markAsFailed('REQ-001', 'Error message');

// Retry failed requests
const failed = queueRepo.getRetryableFailed(maxRetries);
```

### Conflict Resolution

```javascript
const conflictRepo = repos.conflicts;

// Log conflict
conflictRepo.logConflict(
  'version_mismatch',
  'invoice',
  'INV-001',
  { local: 'data' },
  { remote: 'data' }
);

// Get unresolved
const unresolved = conflictRepo.getUnresolvedConflicts();

// Resolve
conflictRepo.resolve(conflictId, { merged: 'data' }, 'manual_merge', 'user@example.com');
```

### Transactions

```javascript
const result = dbManager.transaction(() => {
  const repos = dbManager.createRepositories();
  
  // Multiple operations are atomic
  repos.invoices.create(invoice1);
  repos.invoices.create(invoice2);
  repos.customers.create(customer1);
  
  return 'success';
});
```

### Database Maintenance

```javascript
// Check integrity
const isIntact = dbManager.checkDatabaseIntegrity();

// Repair
dbManager.repair();

// Backup
dbManager.backup('./backup.db');

// Restore
dbManager.restoreFromBackup('./backup.db');

// Vacuum (cleanup)
dbManager.vacuum();

// Get statistics
const stats = dbManager.getStats();
// { invoices: 100, customers: 50, ... }
```

## Serialization

The serialization layer automatically converts between ERPNext API payloads and database records.

```javascript
import { Serializer } from './src/db/serialization.js';

// Serialize ERPNext payload for storage
const dbInvoice = Serializer.serializeInvoice(erpnextInvoice);

// Deserialize from database to application format
const appInvoice = Serializer.deserializeInvoice(dbRow);
```

## Migrations

Migrations are automatically executed on initialization:

```javascript
const migrator = new Migrator(db);
migrator.initialize();  // Creates tables if needed

// Rollback to previous state
migrator.rollback();

// Check pending migrations
const pending = migrator.getPendingMigrations();

// Check executed migrations
const executed = migrator.getExecutedMigrations();
```

## Error Handling

The database layer provides comprehensive error handling:

```javascript
try {
  dbManager.open();
  dbManager.initialize();
  
  const repos = dbManager.createRepositories();
  const invoice = repos.invoices.findById('NON-EXISTENT');
  // Returns null safely instead of throwing
  
  const isHealthy = dbManager.checkDatabaseIntegrity();
  if (!isHealthy) {
    dbManager.repair();
  }
} catch (error) {
  console.error('Database error:', error.message);
  // Implement recovery strategy
  dbManager.restoreFromBackup('./backup.db');
}
```

## Testing

### Run Smoke Tests

```bash
npm test
```

Smoke tests verify:
- Database initialization
- Schema creation
- CRUD operations
- Serialization/deserialization
- Error handling
- Data persistence
- Database integrity

### Run Unit Tests (with Jest)

```bash
npm run test:unit
```

## Performance Considerations

1. **Indexes**: Strategic indexes on frequently queried columns
2. **WAL Mode**: Write-Ahead Logging for concurrent access
3. **Pragma Settings**:
   - `journal_mode = WAL`
   - `synchronous = NORMAL`
   - `temp_store = MEMORY`
4. **Batch Operations**: Use `bulkCreate` and transactions for multiple records
5. **Pagination**: Use limit/offset for large result sets

## Constants and Enums

```javascript
import { 
  INVOICE_STATUS,
  SYNC_STATUS,
  QUEUE_STATUS,
  CONFLICT_TYPE 
} from './src/db/constants.js';

// Usage
INVOICE_STATUS.DRAFT      // 'Draft'
INVOICE_STATUS.SUBMITTED  // 'Submitted'

SYNC_STATUS.PENDING       // 'pending'
SYNC_STATUS.SYNCED        // 'synced'

QUEUE_STATUS.PENDING      // 'pending'
QUEUE_STATUS.COMPLETED    // 'completed'

CONFLICT_TYPE.VERSION_MISMATCH  // 'version_mismatch'
```

## Recovery Scenarios

### Database Corruption

```javascript
if (!dbManager.checkDatabaseIntegrity()) {
  console.warn('Database corrupted, attempting repair...');
  dbManager.repair();
  
  // If repair fails, restore from backup
  dbManager.restoreFromBackup('./backup.db');
}
```

### Transaction Rollback

The database automatically rolls back failed transactions:

```javascript
try {
  dbManager.transaction(() => {
    repos.invoices.create(invoice);
    // If next operation fails, create is rolled back
    repos.invoices.create(invalidInvoice);
  });
} catch (error) {
  // Transaction is automatically rolled back
  console.error('Transaction failed:', error);
}
```

### Sync Recovery

The queue system supports retry logic:

```javascript
const queueRepo = repos.queue;

// Mark for retry
queueRepo.markAsFailed('REQ-001', 'Network error');

// Later, retry failed requests
const retryable = queueRepo.getRetryableFailed(maxRetries = 3);
for (const request of retryable) {
  try {
    // Retry operation
    await syncService.process(request);
    queueRepo.markAsCompleted(request.id, response);
  } catch (error) {
    queueRepo.incrementRetryCount(request.id);
  }
}
```

## Best Practices

1. **Always Use Repositories**: Don't query directly, use repository methods
2. **Close Connections**: Call `dbManager.close()` when application closes
3. **Use Transactions**: For multi-entity operations, use transactions
4. **Handle Nulls**: Repository methods return `null` for missing data
5. **Backup Regularly**: Implement periodic backups for production
6. **Monitor Sync Status**: Track sync_status and conflict_logs
7. **Clean Up Queue**: Periodically remove completed queue items
8. **Serialize Properly**: Use Serializer for consistent data transformation

## Troubleshooting

### "Database is locked"
- Ensure database is not opened in multiple processes
- Use WAL mode for concurrent access
- Check for long-running transactions

### "Foreign key constraint failed"
- Ensure parent records exist before creating children
- Delete children before deleting parents
- Check referential integrity in code

### "Out of memory"
- Use pagination for large queries
- Implement batch processing
- Call `vacuum()` periodically

### Sync metadata not updating
- Ensure `syncMetadata.initializeMetadata()` is called for new entity types
- Check sync_interval_seconds configuration
- Verify last_sync_time is being updated

## Dependencies

- **better-sqlite3** (^9.0.0): Synchronous SQLite3 binding for Node.js
- **dotenv** (^16.3.1): Environment variable management
