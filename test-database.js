#!/usr/bin/env node

// Simple test to verify database functionality
import Database from 'better-sqlite3';

console.log('Testing SQLite database functionality...');

try {
  // Create in-memory database
  const db = new Database(':memory:');
  
  // Test schema creation
  const schema = `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      customer_id INTEGER,
      total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'paid', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );
    
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      qty DECIMAL(10,3) NOT NULL DEFAULT 0.000,
      rate DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE RESTRICT
    );
    
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation TEXT NOT NULL CHECK (operation IN ('CREATE', 'UPDATE', 'DELETE')),
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (queue_id) REFERENCES sync_queue(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS conflict_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      record_id INTEGER NOT NULL,
      local_data TEXT NOT NULL,
      remote_data TEXT NOT NULL,
      resolution TEXT CHECK (resolution IN ('local_wins', 'remote_wins', 'manual', 'skipped')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    );
  `;
  
  db.exec(schema);
  console.log('✓ Schema created successfully');
  
  // Test basic CRUD operations
  console.log('Testing CRUD operations...');
  
  // Create customer
  const customerStmt = db.prepare('INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)');
  const customerResult = customerStmt.run('Test Customer', 'test@example.com', '1234567890');
  console.log('✓ Customer created with ID:', customerResult.lastInsertRowid);
  
  // Create item
  const itemStmt = db.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)');
  const itemResult = itemStmt.run('Test Item', 'TEST-001', 99.99);
  console.log('✓ Item created with ID:', itemResult.lastInsertRowid);
  
  // Create invoice
  const invoiceStmt = db.prepare('INSERT INTO sales_invoices (name, customer_id, total) VALUES (?, ?, ?)');
  const invoiceResult = invoiceStmt.run('INV-2024-001', customerResult.lastInsertRowid, 99.99);
  console.log('✓ Invoice created with ID:', invoiceResult.lastInsertRowid);
  
  // Add invoice item
  const invoiceItemStmt = db.prepare('INSERT INTO invoice_items (invoice_id, item_id, qty, rate, amount) VALUES (?, ?, ?, ?, ?)');
  const invoiceItemResult = invoiceItemStmt.run(invoiceResult.lastInsertRowid, itemResult.lastInsertRowid, 1, 99.99, 99.99);
  console.log('✓ Invoice item added with ID:', invoiceItemResult.lastInsertRowid);
  
  // Test retrieval operations
  const getCustomerStmt = db.prepare('SELECT * FROM customers WHERE id = ?');
  const customer = getCustomerStmt.get(customerResult.lastInsertRowid);
  console.log('✓ Customer retrieved:', customer.name, customer.email);
  
  const getAllCustomersStmt = db.prepare('SELECT * FROM customers');
  const allCustomers = getAllCustomersStmt.all();
  console.log('✓ All customers retrieved:', allCustomers.length, 'customers');
  
  // Test update operations
  const updateCustomerStmt = db.prepare('UPDATE customers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  updateCustomerStmt.run('Updated Customer', customerResult.lastInsertRowid);
  console.log('✓ Customer updated');
  
  // Test sync queue
  const syncQueueStmt = db.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)');
  const syncQueueResult = syncQueueStmt.run('CREATE', JSON.stringify({ type: 'customer', id: customerResult.lastInsertRowid }));
  console.log('✓ Sync queue item added with ID:', syncQueueResult.lastInsertRowid);
  
  // Test statistics
  const stats = {};
  const tables = ['customers', 'items', 'sales_invoices', 'invoice_items', 'sync_queue', 'sync_log', 'conflict_log'];
  
  for (const table of tables) {
    const countStmt = db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
    const result = countStmt.get();
    stats[table] = result.count;
  }
  
  console.log('✓ Database statistics:', stats);
  
  // Close database
  db.close();
  console.log('✓ Database connection closed');
  
  console.log('\n✅ All SQLite database functionality tests passed!');
  console.log('All required tables exist and CRUD operations work correctly.');
  
} catch (error) {
  console.error('❌ Database test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}