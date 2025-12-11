import { TABLES } from './constants.js';

export const SCHEMA = {
  [TABLES.INVOICES]: {
    name: TABLES.INVOICES,
    columns: [
      { name: 'id', type: 'TEXT PRIMARY KEY', description: 'Unique invoice ID (ERPNext name)' },
      { name: 'doctype', type: 'TEXT NOT NULL', description: 'Always "Sales Invoice"' },
      { name: 'name', type: 'TEXT NOT NULL UNIQUE', description: 'Invoice name/number' },
      { name: 'customer', type: 'TEXT NOT NULL', description: 'Customer ID' },
      { name: 'customer_name', type: 'TEXT', description: 'Customer display name' },
      { name: 'status', type: 'TEXT NOT NULL DEFAULT "Draft"', description: 'Invoice status' },
      { name: 'posting_date', type: 'TEXT', description: 'Invoice date' },
      { name: 'due_date', type: 'TEXT', description: 'Payment due date' },
      { name: 'total_quantity', type: 'REAL DEFAULT 0', description: 'Total quantity of items' },
      { name: 'base_total', type: 'REAL DEFAULT 0', description: 'Total amount before tax' },
      { name: 'base_grand_total', type: 'REAL DEFAULT 0', description: 'Total amount including tax' },
      { name: 'outstanding_amount', type: 'REAL DEFAULT 0', description: 'Outstanding/unpaid amount' },
      { name: 'paid_amount', type: 'REAL DEFAULT 0', description: 'Amount paid' },
      { name: 'remarks', type: 'TEXT', description: 'Additional remarks' },
      { name: 'erpnext_data', type: 'TEXT', description: 'Full ERPNext payload (JSON)' },
      { name: 'sync_status', type: 'TEXT NOT NULL DEFAULT "pending"', description: 'Sync status' },
      { name: 'local_modified', type: 'INTEGER DEFAULT 0', description: 'Local modification flag' },
      { name: 'erpnext_modified', type: 'TEXT', description: 'Last modified timestamp from ERPNext' },
      { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Last update timestamp' },
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_sync_status ON invoices(sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at)',
    ],
  },

  [TABLES.INVOICE_ITEMS]: {
    name: TABLES.INVOICE_ITEMS,
    columns: [
      { name: 'id', type: 'TEXT PRIMARY KEY', description: 'Unique item ID' },
      { name: 'invoice_id', type: 'TEXT NOT NULL', description: 'Parent invoice ID' },
      { name: 'item_code', type: 'TEXT NOT NULL', description: 'Item code/SKU' },
      { name: 'item_name', type: 'TEXT', description: 'Item display name' },
      { name: 'description', type: 'TEXT', description: 'Item description' },
      { name: 'quantity', type: 'REAL NOT NULL DEFAULT 0', description: 'Item quantity' },
      { name: 'stock_qty', type: 'REAL DEFAULT 0', description: 'Stock quantity' },
      { name: 'uom', type: 'TEXT', description: 'Unit of measurement' },
      { name: 'rate', type: 'REAL NOT NULL DEFAULT 0', description: 'Unit rate' },
      { name: 'amount', type: 'REAL DEFAULT 0', description: 'Total amount (qty * rate)' },
      { name: 'discount_percentage', type: 'REAL DEFAULT 0', description: 'Discount percentage' },
      { name: 'discount_amount', type: 'REAL DEFAULT 0', description: 'Discount amount' },
      { name: 'tax_rate', type: 'REAL DEFAULT 0', description: 'Tax rate' },
      { name: 'tax_amount', type: 'REAL DEFAULT 0', description: 'Tax amount' },
      { name: 'serial_number', type: 'TEXT', description: 'Serial number if applicable' },
      { name: 'batch_no', type: 'TEXT', description: 'Batch number if applicable' },
      { name: 'warehouse', type: 'TEXT', description: 'Warehouse location' },
      { name: 'erpnext_data', type: 'TEXT', description: 'Full ERPNext item payload (JSON)' },
      { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Last update timestamp' },
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)',
      'CREATE INDEX IF NOT EXISTS idx_invoice_items_item_code ON invoice_items(item_code)',
    ],
  },

  [TABLES.CUSTOMERS]: {
    name: TABLES.CUSTOMERS,
    columns: [
      { name: 'id', type: 'TEXT PRIMARY KEY', description: 'Customer ID (ERPNext name)' },
      { name: 'doctype', type: 'TEXT NOT NULL', description: 'Always "Customer"' },
      { name: 'name', type: 'TEXT NOT NULL UNIQUE', description: 'Customer name' },
      { name: 'customer_name', type: 'TEXT', description: 'Display name' },
      { name: 'email', type: 'TEXT', description: 'Customer email' },
      { name: 'phone', type: 'TEXT', description: 'Customer phone' },
      { name: 'mobile_no', type: 'TEXT', description: 'Customer mobile number' },
      { name: 'customer_group', type: 'TEXT', description: 'Customer group' },
      { name: 'territory', type: 'TEXT', description: 'Territory' },
      { name: 'address', type: 'TEXT', description: 'Billing address' },
      { name: 'city', type: 'TEXT', description: 'City' },
      { name: 'state', type: 'TEXT', description: 'State/Province' },
      { name: 'country', type: 'TEXT', description: 'Country' },
      { name: 'pincode', type: 'TEXT', description: 'Postal/ZIP code' },
      { name: 'credit_limit', type: 'REAL DEFAULT 0', description: 'Credit limit' },
      { name: 'outstanding_amount', type: 'REAL DEFAULT 0', description: 'Outstanding amount' },
      { name: 'disabled', type: 'INTEGER DEFAULT 0', description: 'Is customer disabled' },
      { name: 'erpnext_data', type: 'TEXT', description: 'Full ERPNext payload (JSON)' },
      { name: 'sync_status', type: 'TEXT NOT NULL DEFAULT "pending"', description: 'Sync status' },
      { name: 'erpnext_modified', type: 'TEXT', description: 'Last modified timestamp from ERPNext' },
      { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Last update timestamp' },
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_customers_customer_name ON customers(customer_name)',
      'CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)',
      'CREATE INDEX IF NOT EXISTS idx_customers_sync_status ON customers(sync_status)',
    ],
  },

  [TABLES.QUEUED_REQUESTS]: {
    name: TABLES.QUEUED_REQUESTS,
    columns: [
      { name: 'id', type: 'TEXT PRIMARY KEY', description: 'Unique request ID' },
      { name: 'request_type', type: 'TEXT NOT NULL', description: 'Type: create, update, delete' },
      { name: 'entity_type', type: 'TEXT NOT NULL', description: 'Entity type: invoice, customer' },
      { name: 'entity_id', type: 'TEXT NOT NULL', description: 'Entity ID being operated on' },
      { name: 'operation', type: 'TEXT NOT NULL', description: 'Operation: insert, update, delete' },
      { name: 'payload', type: 'TEXT NOT NULL', description: 'Request payload (JSON)' },
      { name: 'status', type: 'TEXT NOT NULL DEFAULT "pending"', description: 'Queue status' },
      { name: 'priority', type: 'INTEGER DEFAULT 5', description: 'Priority (1-10, 10 highest)' },
      { name: 'retry_count', type: 'INTEGER DEFAULT 0', description: 'Number of retries' },
      { name: 'max_retries', type: 'INTEGER DEFAULT 3', description: 'Maximum retries allowed' },
      { name: 'error_message', type: 'TEXT', description: 'Error message if failed' },
      { name: 'response_data', type: 'TEXT', description: 'Response from server (JSON)' },
      { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Last update timestamp' },
      { name: 'processed_at', type: 'DATETIME', description: 'Completion timestamp' },
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_queued_requests_status ON queued_requests(status)',
      'CREATE INDEX IF NOT EXISTS idx_queued_requests_entity ON queued_requests(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_queued_requests_priority ON queued_requests(priority DESC)',
      'CREATE INDEX IF NOT EXISTS idx_queued_requests_created_at ON queued_requests(created_at)',
    ],
  },

  [TABLES.SYNC_METADATA]: {
    name: TABLES.SYNC_METADATA,
    columns: [
      { name: 'id', type: 'TEXT PRIMARY KEY', description: 'Metadata ID' },
      { name: 'entity_type', type: 'TEXT NOT NULL UNIQUE', description: 'Entity type: invoices, customers' },
      { name: 'last_sync_time', type: 'DATETIME', description: 'Last successful sync timestamp' },
      { name: 'sync_token', type: 'TEXT', description: 'Sync token for incremental sync' },
      { name: 'last_sync_count', type: 'INTEGER DEFAULT 0', description: 'Number of items in last sync' },
      { name: 'total_synced_count', type: 'INTEGER DEFAULT 0', description: 'Total items synced' },
      { name: 'is_initial_sync_done', type: 'INTEGER DEFAULT 0', description: 'Initial sync completed' },
      { name: 'next_sync_time', type: 'DATETIME', description: 'Scheduled next sync time' },
      { name: 'sync_interval_seconds', type: 'INTEGER DEFAULT 3600', description: 'Sync interval in seconds' },
      { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Creation timestamp' },
      { name: 'updated_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Last update timestamp' },
    ],
    indexes: [],
  },

  [TABLES.CONFLICT_LOGS]: {
    name: TABLES.CONFLICT_LOGS,
    columns: [
      { name: 'id', type: 'TEXT PRIMARY KEY', description: 'Conflict log ID' },
      { name: 'conflict_type', type: 'TEXT NOT NULL', description: 'Conflict type' },
      { name: 'entity_type', type: 'TEXT NOT NULL', description: 'Entity type: invoice, customer' },
      { name: 'entity_id', type: 'TEXT NOT NULL', description: 'Entity ID with conflict' },
      { name: 'local_data', type: 'TEXT', description: 'Local version (JSON)' },
      { name: 'remote_data', type: 'TEXT', description: 'Remote version (JSON)' },
      { name: 'merged_data', type: 'TEXT', description: 'Resolved merged version (JSON)' },
      { name: 'resolution_status', type: 'TEXT DEFAULT "pending"', description: 'pending, resolved, rejected' },
      { name: 'resolution_method', type: 'TEXT', description: 'How conflict was resolved' },
      { name: 'resolved_by', type: 'TEXT', description: 'User who resolved' },
      { name: 'notes', type: 'TEXT', description: 'Additional notes' },
      { name: 'created_at', type: 'DATETIME DEFAULT CURRENT_TIMESTAMP', description: 'Creation timestamp' },
      { name: 'resolved_at', type: 'DATETIME', description: 'Resolution timestamp' },
    ],
    indexes: [
      'CREATE INDEX IF NOT EXISTS idx_conflict_logs_entity ON conflict_logs(entity_type, entity_id)',
      'CREATE INDEX IF NOT EXISTS idx_conflict_logs_status ON conflict_logs(resolution_status)',
      'CREATE INDEX IF NOT EXISTS idx_conflict_logs_created_at ON conflict_logs(created_at)',
    ],
  },
};

export function getCreateTableSQL(tableName) {
  const table = SCHEMA[tableName];
  if (!table) {
    throw new Error(`Table schema not found: ${tableName}`);
  }

  const columnDefs = table.columns.map(col => `${col.name} ${col.type}`).join(', ');
  return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`;
}

export function getCreateIndexesSQL(tableName) {
  const table = SCHEMA[tableName];
  if (!table) {
    throw new Error(`Table schema not found: ${tableName}`);
  }
  return table.indexes;
}
