import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import { logger } from '../logger.js';

const MODULE = 'Database';

class POSDatabase {
  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'posawsome.db');
    this.db = null;
    this.initialized = false;
  }

  initialize() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      this.initialized = true;
      logger.info(MODULE, 'Database initialized', { dbPath: this.dbPath });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to initialize database', { error: error.message });
      return false;
    }
  }

  // Customers operations
  createCustomer(name, email = null, phone = null) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)
      `);
      const result = stmt.run(name, email, phone);

      logger.info(MODULE, 'Customer created', { id: result.lastInsertRowid, name, email });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to create customer', { error: error.message, name, email });
      throw error;
    }
  }

  getCustomer(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM customers WHERE id = ?');
      return stmt.get(id);
    } catch (error) {
      logger.error(MODULE, 'Failed to get customer', { error: error.message, id });
      throw error;
    }
  }

  getAllCustomers() {
    try {
      const stmt = this.db.prepare('SELECT * FROM customers ORDER BY created_at DESC');
      return stmt.all();
    } catch (error) {
      logger.error(MODULE, 'Failed to get all customers', { error: error.message });
      throw error;
    }
  }

  updateCustomer(id, name, email = null, phone = null) {
    try {
      const stmt = this.db.prepare(`
        UPDATE customers SET name = ?, email = ?, phone = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const result = stmt.run(name, email, phone, id);

      if (result.changes === 0) {
        throw new Error(`Customer with id ${id} not found`);
      }

      logger.info(MODULE, 'Customer updated', { id, name, email });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to update customer', { error: error.message, id });
      throw error;
    }
  }

  deleteCustomer(id) {
    try {
      const stmt = this.db.prepare('DELETE FROM customers WHERE id = ?');
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw new Error(`Customer with id ${id} not found`);
      }

      logger.info(MODULE, 'Customer deleted', { id });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to delete customer', { error: error.message, id });
      throw error;
    }
  }

  // Items operations
  createItem(name, sku, price) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO items (name, sku, price) VALUES (?, ?, ?)
      `);
      const result = stmt.run(name, sku, price);

      logger.info(MODULE, 'Item created', { id: result.lastInsertRowid, name, sku, price });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to create item', { error: error.message, name, sku });
      throw error;
    }
  }

  getItem(id) {
    try {
      const stmt = this.db.prepare('SELECT * FROM items WHERE id = ?');
      return stmt.get(id);
    } catch (error) {
      logger.error(MODULE, 'Failed to get item', { error: error.message, id });
      throw error;
    }
  }

  getItemBySKU(sku) {
    try {
      const stmt = this.db.prepare('SELECT * FROM items WHERE sku = ?');
      return stmt.get(sku);
    } catch (error) {
      logger.error(MODULE, 'Failed to get item by SKU', { error: error.message, sku });
      throw error;
    }
  }

  getAllItems() {
    try {
      const stmt = this.db.prepare('SELECT * FROM items ORDER BY created_at DESC');
      return stmt.all();
    } catch (error) {
      logger.error(MODULE, 'Failed to get all items', { error: error.message });
      throw error;
    }
  }

  updateItem(id, name, sku, price) {
    try {
      const stmt = this.db.prepare(`
        UPDATE items SET name = ?, sku = ?, price = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const result = stmt.run(name, sku, price, id);

      if (result.changes === 0) {
        throw new Error(`Item with id ${id} not found`);
      }

      logger.info(MODULE, 'Item updated', { id, name, sku, price });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to update item', { error: error.message, id });
      throw error;
    }
  }

  deleteItem(id) {
    try {
      const stmt = this.db.prepare('DELETE FROM items WHERE id = ?');
      const result = stmt.run(id);

      if (result.changes === 0) {
        throw new Error(`Item with id ${id} not found`);
      }

      logger.info(MODULE, 'Item deleted', { id });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to delete item', { error: error.message, id });
      throw error;
    }
  }

  // Sales Invoices operations
  createInvoice(name, customerId = null, total = 0) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sales_invoices (name, customer_id, total) VALUES (?, ?, ?)
      `);
      const result = stmt.run(name, customerId, total);

      logger.info(MODULE, 'Invoice created', {
        id: result.lastInsertRowid,
        name,
        customerId,
        total,
      });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to create invoice', { error: error.message, name });
      throw error;
    }
  }

  getInvoice(id) {
    try {
      const stmt = this.db.prepare(`
        SELECT si.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        WHERE si.id = ?
      `);
      return stmt.get(id);
    } catch (error) {
      logger.error(MODULE, 'Failed to get invoice', { error: error.message, id });
      throw error;
    }
  }

  getAllInvoices() {
    try {
      const stmt = this.db.prepare(`
        SELECT si.*, c.name as customer_name, c.email as customer_email
        FROM sales_invoices si
        LEFT JOIN customers c ON si.customer_id = c.id
        ORDER BY si.created_at DESC
      `);
      return stmt.all();
    } catch (error) {
      logger.error(MODULE, 'Failed to get all invoices', { error: error.message });
      throw error;
    }
  }

  updateInvoiceStatus(id, status) {
    try {
      const validStatuses = ['draft', 'submitted', 'paid', 'cancelled'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      const stmt = this.db.prepare(`
        UPDATE sales_invoices SET status = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const result = stmt.run(status, id);

      if (result.changes === 0) {
        throw new Error(`Invoice with id ${id} not found`);
      }

      logger.info(MODULE, 'Invoice status updated', { id, status });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to update invoice status', { error: error.message, id, status });
      throw error;
    }
  }

  setInvoiceSyncTime(id) {
    try {
      const stmt = this.db.prepare(`
        UPDATE sales_invoices SET synced_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const result = stmt.run(id);

      return result.changes > 0;
    } catch (error) {
      logger.error(MODULE, 'Failed to set invoice sync time', { error: error.message, id });
      throw error;
    }
  }

  // Invoice Items operations
  addInvoiceItem(invoiceId, itemId, qty, rate) {
    try {
      const amount = qty * rate;
      const stmt = this.db.prepare(`
        INSERT INTO invoice_items (invoice_id, item_id, qty, rate, amount) 
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(invoiceId, itemId, qty, rate, amount);

      logger.info(MODULE, 'Invoice item added', {
        id: result.lastInsertRowid,
        invoiceId,
        itemId,
        qty,
        rate,
        amount,
      });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to add invoice item', {
        error: error.message,
        invoiceId,
        itemId,
      });
      throw error;
    }
  }

  getInvoiceItems(invoiceId) {
    try {
      const stmt = this.db.prepare(`
        SELECT ii.*, i.name as item_name, i.sku as item_sku
        FROM invoice_items ii
        JOIN items i ON ii.item_id = i.id
        WHERE ii.invoice_id = ?
        ORDER BY ii.id
      `);
      return stmt.all(invoiceId);
    } catch (error) {
      logger.error(MODULE, 'Failed to get invoice items', { error: error.message, invoiceId });
      throw error;
    }
  }

  updateInvoiceTotal(invoiceId) {
    try {
      const stmt = this.db.prepare(`
        UPDATE sales_invoices 
        SET total = (SELECT SUM(amount) FROM invoice_items WHERE invoice_id = ?)
        WHERE id = ?
      `);
      const result = stmt.run(invoiceId, invoiceId);

      logger.debug(MODULE, 'Invoice total updated', { invoiceId });
      return result.changes > 0;
    } catch (error) {
      logger.error(MODULE, 'Failed to update invoice total', { error: error.message, invoiceId });
      throw error;
    }
  }

  // Sync Queue operations
  addToSyncQueue(operation, payload) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_queue (operation, payload) VALUES (?, ?)
      `);
      const result = stmt.run(operation, JSON.stringify(payload));

      logger.info(MODULE, 'Added to sync queue', {
        id: result.lastInsertRowid,
        operation,
      });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to add to sync queue', { error: error.message, operation });
      throw error;
    }
  }

  getSyncQueue(status = 'pending', limit = 50) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM sync_queue 
        WHERE status = ? 
        ORDER BY created_at ASC 
        LIMIT ?
      `);
      const results = stmt.all(status, limit);

      return results.map((row) => ({
        ...row,
        payload: JSON.parse(row.payload),
      }));
    } catch (error) {
      logger.error(MODULE, 'Failed to get sync queue', { error: error.message, status });
      throw error;
    }
  }

  updateSyncQueueStatus(id, status, errorMessage = null) {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_queue 
        SET status = ?, updated_at = CURRENT_TIMESTAMP, error_message = ?
        WHERE id = ?
      `);
      const result = stmt.run(status, errorMessage, id);

      return result.changes > 0;
    } catch (error) {
      logger.error(MODULE, 'Failed to update sync queue status', {
        error: error.message,
        id,
        status,
      });
      throw error;
    }
  }

  incrementSyncRetry(id) {
    try {
      const stmt = this.db.prepare(`
        UPDATE sync_queue 
        SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);
      const result = stmt.run(id);

      return result.changes > 0;
    } catch (error) {
      logger.error(MODULE, 'Failed to increment sync retry', { error: error.message, id });
      throw error;
    }
  }

  // Sync Log operations
  addSyncLog(queueId, status, response = null) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_log (queue_id, status, response) VALUES (?, ?, ?)
      `);
      const result = stmt.run(queueId, status, response ? JSON.stringify(response) : null);

      logger.debug(MODULE, 'Sync log added', { id: result.lastInsertRowid, queueId, status });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to add sync log', { error: error.message, queueId, status });
      throw error;
    }
  }

  getSyncLogs(limit = 100) {
    try {
      const stmt = this.db.prepare(`
        SELECT sl.*, sq.operation
        FROM sync_log sl
        JOIN sync_queue sq ON sl.queue_id = sq.id
        ORDER BY sl.created_at DESC
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      logger.error(MODULE, 'Failed to get sync logs', { error: error.message });
      throw error;
    }
  }

  // Conflict Log operations
  addConflictLog(tableName, recordId, localData, remoteData, resolution = null) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO conflict_log (table_name, record_id, local_data, remote_data, resolution) 
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        tableName,
        recordId,
        JSON.stringify(localData),
        JSON.stringify(remoteData),
        resolution
      );

      logger.info(MODULE, 'Conflict logged', {
        id: result.lastInsertRowid,
        tableName,
        recordId,
      });
      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to add conflict log', {
        error: error.message,
        tableName,
        recordId,
      });
      throw error;
    }
  }

  getUnresolvedConflicts() {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM conflict_log 
        WHERE resolution IS NULL 
        ORDER BY created_at ASC
      `);
      const results = stmt.all();

      return results.map((row) => ({
        ...row,
        local_data: JSON.parse(row.local_data),
        remote_data: JSON.parse(row.remote_data),
      }));
    } catch (error) {
      logger.error(MODULE, 'Failed to get unresolved conflicts', { error: error.message });
      throw error;
    }
  }

  resolveConflict(id, resolution) {
    try {
      const validResolutions = ['local_wins', 'remote_wins', 'manual', 'skipped'];
      if (!validResolutions.includes(resolution)) {
        throw new Error(`Invalid resolution: ${resolution}`);
      }

      const stmt = this.db.prepare(`
        UPDATE conflict_log 
        SET resolution = ?, resolved_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const result = stmt.run(resolution, id);

      logger.info(MODULE, 'Conflict resolved', { id, resolution });
      return result.changes > 0;
    } catch (error) {
      logger.error(MODULE, 'Failed to resolve conflict', { error: error.message, id, resolution });
      throw error;
    }
  }

  // Database statistics
  getStats() {
    try {
      const stats = {};

      const tables = [
        'customers',
        'items',
        'sales_invoices',
        'invoice_items',
        'sync_queue',
        'sync_log',
        'conflict_log',
      ];

      tables.forEach((table) => {
        const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`);
        const result = stmt.get();
        stats[table] = result.count;
      });

      return stats;
    } catch (error) {
      logger.error(MODULE, 'Failed to get database stats', { error: error.message });
      throw error;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.initialized = false;
      logger.info(MODULE, 'Database connection closed');
    }
  }
}

export const posDatabase = new POSDatabase();
