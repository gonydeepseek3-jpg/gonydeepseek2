import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';

// Mock the logger
vi.mock('../../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((path) => {
      if (path === 'userData') {
        return '/tmp/test-user-data';
      }
      return '';
    })
  }
}));

// Import after mocking
let testDbPath;
let testDb;

describe('Database Operations', () => {
  beforeEach(() => {
    // Create fresh in-memory database for each test
    testDbPath = ':memory:';
    testDb = new Database(testDbPath);
    
    // Create all required tables
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
      
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    testDb.exec(schema);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (testDb) {
      testDb.close();
    }
  });

  describe('Customer Operations', () => {
    it('should create a customer', () => {
      const stmt = testDb.prepare('INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)');
      const result = stmt.run('John Doe', 'john@example.com', '1234567890');
      
      expect(result.lastInsertRowid).toBe(1);
      
      const customerStmt = testDb.prepare('SELECT * FROM customers WHERE id = ?');
      const customer = customerStmt.get(1);
      
      expect(customer.name).toBe('John Doe');
      expect(customer.email).toBe('john@example.com');
      expect(customer.phone).toBe('1234567890');
      expect(customer.id).toBe(1);
    });

    it('should get all customers', () => {
      testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)').run('John Doe', 'john@example.com');
      testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)').run('Jane Smith', 'jane@example.com');
      
      const customers = testDb.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
      
      expect(customers).toHaveLength(2);
      expect(customers[0].name).toBe('John Doe');
      expect(customers[1].name).toBe('Jane Smith');
    });

    it('should update a customer', () => {
      const insertStmt = testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)');
      const result = insertStmt.run('John Doe', 'john@example.com');
      
      const updateStmt = testDb.prepare('UPDATE customers SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const updateResult = updateStmt.run('John Updated', 'john.updated@example.com', result.lastInsertRowid);
      
      expect(updateResult.changes).toBe(1);
      
      const getStmt = testDb.prepare('SELECT * FROM customers WHERE id = ?');
      const customer = getStmt.get(result.lastInsertRowid);
      
      expect(customer.name).toBe('John Updated');
      expect(customer.email).toBe('john.updated@example.com');
    });

    it('should delete a customer', () => {
      const insertStmt = testDb.prepare('INSERT INTO customers (name) VALUES (?)');
      const result = insertStmt.run('John Doe');
      
      const deleteStmt = testDb.prepare('DELETE FROM customers WHERE id = ?');
      const deleteResult = deleteStmt.run(result.lastInsertRowid);
      
      expect(deleteResult.changes).toBe(1);
      
      const getStmt = testDb.prepare('SELECT * FROM customers WHERE id = ?');
      const customer = getStmt.get(result.lastInsertRowid);
      
      expect(customer).toBeUndefined();
    });

    it('should enforce unique email constraint', () => {
      testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)').run('John Doe', 'john@example.com');
      
      expect(() => {
        testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)').run('Jane Smith', 'john@example.com');
      }).toThrow();
    });
  });

  describe('Item Operations', () => {
    it('should create an item', () => {
      const stmt = testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)');
      const result = stmt.run('Laptop', 'LAPTOP-001', 999.99);
      
      expect(result.lastInsertRowid).toBe(1);
      
      const itemStmt = testDb.prepare('SELECT * FROM items WHERE id = ?');
      const item = itemStmt.get(1);
      
      expect(item.name).toBe('Laptop');
      expect(item.sku).toBe('LAPTOP-001');
      expect(item.price).toBe(999.99);
    });

    it('should get item by SKU', () => {
      testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)').run('Laptop', 'LAPTOP-001', 999.99);
      
      const itemStmt = testDb.prepare('SELECT * FROM items WHERE sku = ?');
      const item = itemStmt.get('LAPTOP-001');
      
      expect(item.name).toBe('Laptop');
      expect(item.price).toBe(999.99);
    });

    it('should get all items', () => {
      testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)').run('Laptop', 'LAPTOP-001', 999.99);
      testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)').run('Mouse', 'MOUSE-001', 29.99);
      
      const items = testDb.prepare('SELECT * FROM items ORDER BY created_at DESC').all();
      
      expect(items).toHaveLength(2);
      expect(items[0].name).toBe('Laptop');
      expect(items[1].name).toBe('Mouse');
    });

    it('should enforce unique SKU constraint', () => {
      testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)').run('Laptop', 'LAPTOP-001', 999.99);
      
      expect(() => {
        testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)').run('Gaming Laptop', 'LAPTOP-001', 1299.99);
      }).toThrow();
    });
  });

  describe('Sales Invoice Operations', () => {
    it('should create an invoice', () => {
      const customerStmt = testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)');
      const customerResult = customerStmt.run('John Doe', 'john@example.com');
      
      const invoiceStmt = testDb.prepare('INSERT INTO sales_invoices (name, customer_id, total) VALUES (?, ?, ?)');
      const invoiceResult = invoiceStmt.run('INV-2024-001', customerResult.lastInsertRowid, 150.00);
      
      expect(invoiceResult.lastInsertRowid).toBe(1);
      
      const getInvoiceStmt = testDb.prepare(`
        SELECT si.*, c.name as customer_name, c.email as customer_email
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        WHERE si.id = ?
      `);
      const invoice = getInvoiceStmt.get(1);
      
      expect(invoice.name).toBe('INV-2024-001');
      expect(invoice.customer_id).toBe(customerResult.lastInsertRowid);
      expect(invoice.total).toBe(150.00);
      expect(invoice.status).toBe('draft');
      expect(invoice.customer_name).toBe('John Doe');
    });

    it('should update invoice status', () => {
      const invoiceStmt = testDb.prepare('INSERT INTO sales_invoices (name) VALUES (?)');
      const invoiceResult = invoiceStmt.run('INV-2024-001');
      
      const updateStmt = testDb.prepare('UPDATE sales_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const updateResult = updateStmt.run('submitted', invoiceResult.lastInsertRowid);
      
      expect(updateResult.changes).toBe(1);
      
      const getStmt = testDb.prepare('SELECT status FROM sales_invoices WHERE id = ?');
      const invoice = getStmt.get(invoiceResult.lastInsertRowid);
      
      expect(invoice.status).toBe('submitted');
    });

    it('should reject invalid invoice status', () => {
      const invoiceStmt = testDb.prepare('INSERT INTO sales_invoices (name) VALUES (?)');
      const invoiceResult = invoiceStmt.run('INV-2024-001');
      
      expect(() => {
        testDb.prepare('UPDATE sales_invoices SET status = ? WHERE id = ?').run('invalid_status', invoiceResult.lastInsertRowid);
      }).toThrow();
    });
  });

  describe('Invoice Items Operations', () => {
    it('should add invoice item and calculate amount', () => {
      const itemStmt = testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)');
      const itemResult = itemStmt.run('Laptop', 'LAPTOP-001', 999.99);
      
      const invoiceStmt = testDb.prepare('INSERT INTO sales_invoices (name) VALUES (?)');
      const invoiceResult = invoiceStmt.run('INV-2024-001');
      
      const invoiceItemStmt = testDb.prepare('INSERT INTO invoice_items (invoice_id, item_id, qty, rate, amount) VALUES (?, ?, ?, ?, ?)');
      const invoiceItemResult = invoiceItemStmt.run(invoiceResult.lastInsertRowid, itemResult.lastInsertRowid, 2, 999.99, 1999.98);
      
      expect(invoiceItemResult.lastInsertRowid).toBe(1);
      
      const getItemsStmt = testDb.prepare(`
        SELECT ii.*, i.name as item_name, i.sku as item_sku
        FROM invoice_items ii
        JOIN items i ON ii.item_id = i.id
        WHERE ii.invoice_id = ?
      `);
      const items = getItemsStmt.all(invoiceResult.lastInsertRowid);
      
      expect(items).toHaveLength(1);
      expect(items[0].item_name).toBe('Laptop');
      expect(items[0].qty).toBe(2);
      expect(items[0].rate).toBe(999.99);
      expect(items[0].amount).toBe(1999.98);
    });
  });

  describe('Sync Queue Operations', () => {
    it('should add item to sync queue', () => {
      const payload = { type: 'customer', data: { name: 'John Doe', email: 'john@example.com' } };
      const stmt = testDb.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)');
      const result = stmt.run('CREATE', JSON.stringify(payload));
      
      expect(result.lastInsertRowid).toBe(1);
    });

    it('should get sync queue items', () => {
      testDb.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)').run('CREATE', JSON.stringify({ type: 'customer', data: { name: 'John Doe' } }));
      testDb.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)').run('UPDATE', JSON.stringify({ type: 'item', data: { id: 1, name: 'Updated Item' } }));
      
      const queue = testDb.prepare('SELECT * FROM sync_queue WHERE status = ? ORDER BY created_at ASC LIMIT 10').all('pending');
      
      expect(queue).toHaveLength(2);
      expect(queue[0].operation).toBe('CREATE');
      expect(queue[1].operation).toBe('UPDATE');
      expect(JSON.parse(queue[0].payload).type).toBe('customer');
    });

    it('should update sync queue status', () => {
      const queueStmt = testDb.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)');
      const queueResult = queueStmt.run('CREATE', JSON.stringify({ type: 'customer', data: {} }));
      
      const updateStmt = testDb.prepare('UPDATE sync_queue SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const updateResult = updateStmt.run('completed', queueResult.lastInsertRowid);
      
      expect(updateResult.changes).toBe(1);
      
      const getCompletedStmt = testDb.prepare('SELECT status FROM sync_queue WHERE id = ?');
      const queue = getCompletedStmt.get(queueResult.lastInsertRowid);
      
      expect(queue.status).toBe('completed');
    });
  });

  describe('Sync Log Operations', () => {
    it('should add sync log entry', () => {
      const queueStmt = testDb.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)');
      const queueResult = queueStmt.run('CREATE', JSON.stringify({ type: 'customer', data: {} }));
      
      const logStmt = testDb.prepare('INSERT INTO sync_log (queue_id, status, response) VALUES (?, ?, ?)');
      const logResult = logStmt.run(queueResult.lastInsertRowid, 'success', JSON.stringify({ message: 'Customer created' }));
      
      expect(logResult.lastInsertRowid).toBe(1);
    });

    it('should get sync logs with queue info', () => {
      const queueStmt = testDb.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)');
      const queueResult1 = queueStmt.run('CREATE', JSON.stringify({ type: 'customer', data: {} }));
      const queueResult2 = queueStmt.run('UPDATE', JSON.stringify({ type: 'item', data: {} }));
      
      testDb.prepare('INSERT INTO sync_log (queue_id, status, response) VALUES (?, ?, ?)').run(queueResult1.lastInsertRowid, 'success', null);
      testDb.prepare('INSERT INTO sync_log (queue_id, status, response) VALUES (?, ?, ?)').run(queueResult2.lastInsertRowid, 'failed', JSON.stringify({ error: 'Network error' }));
      
      const logs = testDb.prepare(`
        SELECT sl.*, sq.operation
        FROM sync_log sl
        JOIN sync_queue sq ON sl.queue_id = sq.id
        ORDER BY sl.created_at DESC
      `).all();
      
      expect(logs).toHaveLength(2);
      expect(logs[0].status).toBe('success');
      expect(logs[1].status).toBe('failed');
      expect(logs[0].operation).toBe('CREATE');
      expect(logs[1].operation).toBe('UPDATE');
    });
  });

  describe('Conflict Log Operations', () => {
    it('should add conflict log entry', () => {
      const localData = { name: 'Local Name', email: 'local@example.com' };
      const remoteData = { name: 'Remote Name', email: 'remote@example.com' };
      
      const stmt = testDb.prepare('INSERT INTO conflict_log (table_name, record_id, local_data, remote_data, resolution) VALUES (?, ?, ?, ?, ?)');
      const result = stmt.run('customers', 1, JSON.stringify(localData), JSON.stringify(remoteData), null);
      
      expect(result.lastInsertRowid).toBe(1);
    });

    it('should get unresolved conflicts', () => {
      testDb.prepare('INSERT INTO conflict_log (table_name, record_id, local_data, remote_data, resolution) VALUES (?, ?, ?, ?, ?)').run('customers', 1, JSON.stringify({ name: 'Local' }), JSON.stringify({ name: 'Remote' }), null);
      testDb.prepare('INSERT INTO conflict_log (table_name, record_id, local_data, remote_data, resolution) VALUES (?, ?, ?, ?, ?)').run('customers', 2, JSON.stringify({ name: 'Local2' }), JSON.stringify({ name: 'Remote2' }), null);
      
      const conflicts = testDb.prepare('SELECT * FROM conflict_log WHERE resolution IS NULL ORDER BY created_at ASC').all();
      
      expect(conflicts).toHaveLength(2);
      expect(conflicts[0].table_name).toBe('customers');
      expect(conflicts[0].resolution).toBeNull();
      expect(JSON.parse(conflicts[0].local_data).name).toBe('Local');
    });

    it('should resolve conflict', () => {
      const conflictStmt = testDb.prepare('INSERT INTO conflict_log (table_name, record_id, local_data, remote_data, resolution) VALUES (?, ?, ?, ?, ?)');
      const conflictResult = conflictStmt.run('customers', 1, JSON.stringify({ name: 'Local' }), JSON.stringify({ name: 'Remote' }), null);
      
      const resolveStmt = testDb.prepare('UPDATE conflict_log SET resolution = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?');
      const resolveResult = resolveStmt.run('remote_wins', conflictResult.lastInsertRowid);
      
      expect(resolveResult.changes).toBe(1);
      
      const unresolvedStmt = testDb.prepare('SELECT * FROM conflict_log WHERE resolution IS NULL');
      const unresolved = unresolvedStmt.all();
      
      expect(unresolved).toHaveLength(0);
    });
  });

  describe('Database Statistics', () => {
    it('should get database statistics', () => {
      testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)').run('John Doe', 'john@example.com');
      testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)').run('Laptop', 'LAPTOP-001', 999.99);
      testDb.prepare('INSERT INTO sales_invoices (name) VALUES (?)').run('INV-2024-001');
      testDb.prepare('INSERT INTO sync_queue (operation, payload) VALUES (?, ?)').run('CREATE', JSON.stringify({ type: 'customer', data: {} }));
      
      const stats = {};
      const tables = ['customers', 'items', 'sales_invoices', 'invoice_items', 'sync_queue', 'sync_log', 'conflict_log'];
      
      tables.forEach(table => {
        const countStmt = testDb.prepare(`SELECT COUNT(*) as count FROM ${table}`);
        const result = countStmt.get();
        stats[table] = result.count;
      });
      
      expect(stats.customers).toBe(1);
      expect(stats.items).toBe(1);
      expect(stats.sales_invoices).toBe(1);
      expect(stats.sync_queue).toBe(1);
      expect(stats.sync_log).toBe(0);
      expect(stats.conflict_log).toBe(0);
      expect(stats.invoice_items).toBe(0);
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should enforce foreign key constraints for invoices', () => {
      expect(() => {
        testDb.prepare('INSERT INTO sales_invoices (name, customer_id, total) VALUES (?, ?, ?)').run('INV-2024-001', 999, 100.00);
      }).toThrow();
    });

    it('should enforce foreign key constraints for invoice items', () => {
      const invoiceStmt = testDb.prepare('INSERT INTO sales_invoices (name) VALUES (?)');
      const invoiceResult = invoiceStmt.run('INV-2024-001');
      
      expect(() => {
        testDb.prepare('INSERT INTO invoice_items (invoice_id, item_id, qty, rate, amount) VALUES (?, ?, ?, ?, ?)').run(invoiceResult.lastInsertRowid, 999, 1, 100.00, 100.00);
      }).toThrow();
    });
  });

  describe('Performance Tests', () => {
    it('should handle multiple customer operations efficiently', () => {
      const start = Date.now();
      
      for (let i = 0; i < 100; i++) {
        testDb.prepare('INSERT INTO customers (name, email) VALUES (?, ?)').run(`Customer ${i}`, `customer${i}@example.com`);
      }
      
      const customers = testDb.prepare('SELECT * FROM customers').all();
      expect(customers).toHaveLength(100);
      
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Data Integrity', () => {
    it('should handle decimal precision correctly', () => {
      const stmt = testDb.prepare('INSERT INTO items (name, sku, price) VALUES (?, ?, ?)');
      const result = stmt.run('Test Item', 'TEST-001', 999.999);
      
      const item = testDb.prepare('SELECT price FROM items WHERE id = ?').get(1);
      expect(item.price).toBe(999.999);
    });

    it('should handle null values correctly', () => {
      const stmt = testDb.prepare('INSERT INTO customers (name) VALUES (?)');
      const result = stmt.run('John Doe');
      
      const customer = testDb.prepare('SELECT * FROM customers WHERE id = ?').get(1);
      expect(customer.email).toBeNull();
      expect(customer.phone).toBeNull();
    });
  });
});

describe('Database Schema Validation', () => {
  it('should have all required tables', () => {
    const db = new Database(':memory:');
    
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
    
    // Verify all tables exist
    const tables = ['customers', 'items', 'sales_invoices', 'invoice_items', 'sync_queue', 'sync_log', 'conflict_log'];
    
    tables.forEach(tableName => {
      const result = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=?').get(tableName);
      expect(result).toBeTruthy();
    });
    
    db.close();
  });

  it('should verify schema.sql contains all required tables', () => {
    const fs = require('fs');
    const path = require('path');
    
    const schemaPath = path.join(__dirname, '../../src/database/schema.sql');
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    
    const requiredTables = [
      'customers',
      'items', 
      'sales_invoices',
      'invoice_items',
      'sync_queue',
      'sync_log',
      'conflict_log'
    ];
    
    requiredTables.forEach(tableName => {
      expect(schemaContent).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    });
  });
});

describe('Database Migrations', () => {
  it('should successfully run migrations', () => {
    const db = new Database(':memory:');
    
    // Simulate migration system
    const migrationTable = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    db.exec(migrationTable);
    
    // Verify migration table exists
    const migrationResult = db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name=\'schema_migrations\'').get();
    expect(migrationResult).toBeTruthy();
    
    // Mark migration as applied
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run('001');
    
    // Verify migration is tracked
    const applied = db.prepare('SELECT * FROM schema_migrations WHERE version = ?').get('001');
    expect(applied).toBeTruthy();
    expect(applied.version).toBe('001');
    
    db.close();
  });
});