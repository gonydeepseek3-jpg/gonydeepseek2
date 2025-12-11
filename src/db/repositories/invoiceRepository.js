import { TABLES } from '../constants.js';
import { Serializer } from '../serialization.js';

export class InvoiceRepository {
  constructor(db) {
    this.db = db;
  }

  create(invoice) {
    const serialized = Serializer.serializeInvoice(invoice);
    const stmt = this.db.prepare(`
      INSERT INTO ${TABLES.INVOICES} (
        id, doctype, name, customer, customer_name, status, posting_date, due_date,
        total_quantity, base_total, base_grand_total, outstanding_amount, paid_amount,
        remarks, erpnext_data, sync_status, local_modified, erpnext_modified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      serialized.id, serialized.doctype, serialized.name, serialized.customer,
      serialized.customer_name, serialized.status, serialized.posting_date, serialized.due_date,
      serialized.total_quantity, serialized.base_total, serialized.base_grand_total,
      serialized.outstanding_amount, serialized.paid_amount, serialized.remarks,
      serialized.erpnext_data, serialized.sync_status, serialized.local_modified,
      serialized.erpnext_modified
    );

    return result;
  }

  update(id, updates) {
    const serialized = Serializer.serializeInvoice(updates);
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

    const sql = `UPDATE ${TABLES.INVOICES} SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.run(...values);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.INVOICES} WHERE id = ?`);
    const row = stmt.get(id);
    return Serializer.deserializeInvoice(row);
  }

  findByName(name) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.INVOICES} WHERE name = ?`);
    const row = stmt.get(name);
    return Serializer.deserializeInvoice(row);
  }

  findByCustomer(customerId, options = {}) {
    const { limit = 100, offset = 0, status = null } = options;
    let sql = `SELECT * FROM ${TABLES.INVOICES} WHERE customer = ?`;
    const params = [customerId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(Serializer.deserializeInvoice);
  }

  findBySyncStatus(syncStatus, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.INVOICES}
      WHERE sync_status = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(syncStatus, limit, offset);
    return rows.map(Serializer.deserializeInvoice);
  }

  findAll(options = {}) {
    const { limit = 100, offset = 0, orderBy = 'created_at DESC' } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.INVOICES}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset);
    return rows.map(Serializer.deserializeInvoice);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.INVOICES} WHERE id = ?`);
    return stmt.run(id);
  }

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${TABLES.INVOICES}`;
    const params = [];

    if (filters.customer) {
      sql += ' WHERE customer = ?';
      params.push(filters.customer);
    }

    if (filters.status) {
      sql += params.length > 0 ? ' AND status = ?' : ' WHERE status = ?';
      params.push(filters.status);
    }

    if (filters.syncStatus) {
      sql += params.length > 0 ? ' AND sync_status = ?' : ' WHERE sync_status = ?';
      params.push(filters.syncStatus);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  updateSyncStatus(id, status) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.INVOICES}
      SET sync_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(status, id);
  }

  updateLocalModified(id, modified = true) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.INVOICES}
      SET local_modified = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(modified ? 1 : 0, id);
  }

  bulkUpdateSyncStatus(ids, status) {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.INVOICES}
      SET sync_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `);
    return stmt.run(status, ...ids);
  }

  clearLocalModifiedFlag(id) {
    return this.updateLocalModified(id, false);
  }

  getModifiedSinceDate(date) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.INVOICES}
      WHERE updated_at > ?
      ORDER BY updated_at DESC
    `);
    const rows = stmt.all(date.toISOString());
    return rows.map(Serializer.deserializeInvoice);
  }

  upsert(invoice) {
    const serialized = Serializer.serializeInvoice(invoice);
    const existing = this.findById(serialized.id);

    if (existing) {
      return this.update(serialized.id, invoice);
    } else {
      return this.create(invoice);
    }
  }
}
