import { TABLES } from '../constants.js';
import { Serializer } from '../serialization.js';

export class InvoiceItemRepository {
  constructor(db) {
    this.db = db;
  }

  create(item) {
    const serialized = Serializer.serializeInvoiceItem(item);
    const stmt = this.db.prepare(`
      INSERT INTO ${TABLES.INVOICE_ITEMS} (
        id, invoice_id, item_code, item_name, description, quantity, stock_qty,
        uom, rate, amount, discount_percentage, discount_amount, tax_rate,
        tax_amount, serial_number, batch_no, warehouse, erpnext_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      serialized.id, serialized.invoice_id, serialized.item_code, serialized.item_name,
      serialized.description, serialized.quantity, serialized.stock_qty, serialized.uom,
      serialized.rate, serialized.amount, serialized.discount_percentage, serialized.discount_amount,
      serialized.tax_rate, serialized.tax_amount, serialized.serial_number, serialized.batch_no,
      serialized.warehouse, serialized.erpnext_data
    );

    return result;
  }

  update(id, updates) {
    const serialized = Serializer.serializeInvoiceItem(updates);
    const fields = [];
    const values = [];

    Object.entries(serialized).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return { changes: 0 };

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE ${TABLES.INVOICE_ITEMS} SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.run(...values);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.INVOICE_ITEMS} WHERE id = ?`);
    const row = stmt.get(id);
    return Serializer.deserializeInvoiceItem(row);
  }

  findByInvoiceId(invoiceId, options = {}) {
    const { limit = 1000, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.INVOICE_ITEMS}
      WHERE invoice_id = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(invoiceId, limit, offset);
    return rows.map(Serializer.deserializeInvoiceItem);
  }

  findByItemCode(itemCode, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.INVOICE_ITEMS}
      WHERE item_code = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(itemCode, limit, offset);
    return rows.map(Serializer.deserializeInvoiceItem);
  }

  findAll(options = {}) {
    const { limit = 1000, offset = 0, orderBy = 'created_at DESC' } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.INVOICE_ITEMS}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset);
    return rows.map(Serializer.deserializeInvoiceItem);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.INVOICE_ITEMS} WHERE id = ?`);
    return stmt.run(id);
  }

  deleteByInvoiceId(invoiceId) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.INVOICE_ITEMS} WHERE invoice_id = ?`);
    return stmt.run(invoiceId);
  }

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${TABLES.INVOICE_ITEMS}`;
    const params = [];

    if (filters.invoiceId) {
      sql += ' WHERE invoice_id = ?';
      params.push(filters.invoiceId);
    }

    if (filters.itemCode) {
      sql += params.length > 0 ? ' AND item_code = ?' : ' WHERE item_code = ?';
      params.push(filters.itemCode);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  countByInvoiceId(invoiceId) {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${TABLES.INVOICE_ITEMS} WHERE invoice_id = ?`);
    const result = stmt.get(invoiceId);
    return result.count;
  }

  getInvoiceTotals(invoiceId) {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as item_count,
        SUM(quantity) as total_qty,
        SUM(amount) as total_amount,
        SUM(tax_amount) as total_tax,
        SUM(discount_amount) as total_discount
      FROM ${TABLES.INVOICE_ITEMS}
      WHERE invoice_id = ?
    `);
    const result = stmt.get(invoiceId);
    return result;
  }

  bulkCreate(items) {
    const transaction = this.db.transaction(() => {
      const results = [];
      for (const item of items) {
        const result = this.create(item);
        results.push(result);
      }
      return results;
    });
    return transaction();
  }

  upsert(item) {
    const serialized = Serializer.serializeInvoiceItem(item);
    const existing = this.findById(serialized.id);

    if (existing) {
      return this.update(serialized.id, item);
    } else {
      return this.create(item);
    }
  }
}
