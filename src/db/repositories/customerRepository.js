import { TABLES } from '../constants.js';
import { Serializer } from '../serialization.js';

export class CustomerRepository {
  constructor(db) {
    this.db = db;
  }

  create(customer) {
    const serialized = Serializer.serializeCustomer(customer);
    const stmt = this.db.prepare(`
      INSERT INTO ${TABLES.CUSTOMERS} (
        id, doctype, name, customer_name, email, phone, mobile_no, customer_group,
        territory, address, city, state, country, pincode, credit_limit,
        outstanding_amount, disabled, erpnext_data, sync_status, erpnext_modified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      serialized.id, serialized.doctype, serialized.name, serialized.customer_name,
      serialized.email, serialized.phone, serialized.mobile_no, serialized.customer_group,
      serialized.territory, serialized.address, serialized.city, serialized.state,
      serialized.country, serialized.pincode, serialized.credit_limit,
      serialized.outstanding_amount, serialized.disabled, serialized.erpnext_data,
      serialized.sync_status, serialized.erpnext_modified
    );

    return result;
  }

  update(id, updates) {
    const serialized = Serializer.serializeCustomer(updates);
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

    const sql = `UPDATE ${TABLES.CUSTOMERS} SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.run(...values);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.CUSTOMERS} WHERE id = ?`);
    const row = stmt.get(id);
    return Serializer.deserializeCustomer(row);
  }

  findByName(name) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.CUSTOMERS} WHERE name = ?`);
    const row = stmt.get(name);
    return Serializer.deserializeCustomer(row);
  }

  findByEmail(email) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.CUSTOMERS} WHERE email = ?`);
    const row = stmt.get(email);
    return Serializer.deserializeCustomer(row);
  }

  findByPhone(phone) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CUSTOMERS}
      WHERE phone = ? OR mobile_no = ?
    `);
    const rows = stmt.all(phone, phone);
    return rows.map(Serializer.deserializeCustomer);
  }

  findAll(options = {}) {
    const { limit = 100, offset = 0, orderBy = 'customer_name ASC' } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CUSTOMERS}
      WHERE disabled = 0
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset);
    return rows.map(Serializer.deserializeCustomer);
  }

  search(query, options = {}) {
    const { limit = 50, offset = 0 } = options;
    const searchPattern = `%${query}%`;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CUSTOMERS}
      WHERE (customer_name LIKE ? OR email LIKE ? OR phone LIKE ? OR mobile_no LIKE ? OR name LIKE ?)
      AND disabled = 0
      ORDER BY customer_name ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, limit, offset);
    return rows.map(Serializer.deserializeCustomer);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.CUSTOMERS} WHERE id = ?`);
    return stmt.run(id);
  }

  disable(id) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.CUSTOMERS}
      SET disabled = 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  enable(id) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.CUSTOMERS}
      SET disabled = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${TABLES.CUSTOMERS} WHERE disabled = 0`;
    const params = [];

    if (filters.customerGroup) {
      sql += ' AND customer_group = ?';
      params.push(filters.customerGroup);
    }

    if (filters.territory) {
      sql += ' AND territory = ?';
      params.push(filters.territory);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  findBySyncStatus(syncStatus, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CUSTOMERS}
      WHERE sync_status = ?
      ORDER BY created_at ASC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(syncStatus, limit, offset);
    return rows.map(Serializer.deserializeCustomer);
  }

  updateSyncStatus(id, status) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.CUSTOMERS}
      SET sync_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(status, id);
  }

  bulkUpdateSyncStatus(ids, status) {
    const placeholders = ids.map(() => '?').join(',');
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.CUSTOMERS}
      SET sync_status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `);
    return stmt.run(status, ...ids);
  }

  upsert(customer) {
    const serialized = Serializer.serializeCustomer(customer);
    const existing = this.findById(serialized.id);

    if (existing) {
      return this.update(serialized.id, customer);
    } else {
      return this.create(customer);
    }
  }
}
