const stringify = (data) => (typeof data === 'string' ? data : JSON.stringify(data));

const parse = (data) => {
  if (data == null) return null;
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

export class PosDataStore {
  constructor(db) {
    this.db = db;
  }

  upsertCustomer(id, data, modifiedAt = null) {
    const stmt = this.db.prepare(`
      INSERT INTO customers (id, data, modified_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        modified_at = excluded.modified_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(id, stringify(data), modifiedAt);
    return true;
  }

  getCustomer(id) {
    const row = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, data: parse(row.data) };
  }

  deleteCustomer(id) {
    const res = this.db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    return res.changes > 0;
  }

  listCustomers(limit = 50, offset = 0) {
    const rows = this.db
      .prepare('SELECT * FROM customers ORDER BY updated_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset);
    return rows.map((r) => ({ ...r, data: parse(r.data) }));
  }

  upsertItem(id, data, modifiedAt = null) {
    const stmt = this.db.prepare(`
      INSERT INTO items (id, data, modified_at, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        modified_at = excluded.modified_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(id, stringify(data), modifiedAt);
    return true;
  }

  getItem(id) {
    const row = this.db.prepare('SELECT * FROM items WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, data: parse(row.data) };
  }

  deleteItem(id) {
    const res = this.db.prepare('DELETE FROM items WHERE id = ?').run(id);
    return res.changes > 0;
  }

  listItems(limit = 50, offset = 0) {
    const rows = this.db
      .prepare('SELECT * FROM items ORDER BY updated_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset);
    return rows.map((r) => ({ ...r, data: parse(r.data) }));
  }

  upsertSalesInvoice(id, customerId, data, modifiedAt = null) {
    const stmt = this.db.prepare(`
      INSERT INTO sales_invoices (id, customer_id, data, modified_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        customer_id = excluded.customer_id,
        data = excluded.data,
        modified_at = excluded.modified_at,
        updated_at = CURRENT_TIMESTAMP
    `);

    stmt.run(id, customerId || null, stringify(data), modifiedAt);
    return true;
  }

  getSalesInvoice(id) {
    const row = this.db.prepare('SELECT * FROM sales_invoices WHERE id = ?').get(id);
    if (!row) return null;
    return { ...row, data: parse(row.data) };
  }

  deleteSalesInvoice(id) {
    const res = this.db.prepare('DELETE FROM sales_invoices WHERE id = ?').run(id);
    return res.changes > 0;
  }

  listSalesInvoices(limit = 50, offset = 0) {
    const rows = this.db
      .prepare('SELECT * FROM sales_invoices ORDER BY updated_at DESC LIMIT ? OFFSET ?')
      .all(limit, offset);
    return rows.map((r) => ({ ...r, data: parse(r.data) }));
  }

  addInvoiceItem(invoiceId, itemId, data) {
    const stmt = this.db.prepare(
      `INSERT INTO invoice_items (invoice_id, item_id, data, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    );

    const res = stmt.run(invoiceId, itemId || null, stringify(data));
    return res.lastInsertRowid;
  }

  getInvoiceItems(invoiceId) {
    const rows = this.db
      .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC')
      .all(invoiceId);
    return rows.map((r) => ({ ...r, data: parse(r.data) }));
  }

  deleteInvoiceItemsForInvoice(invoiceId) {
    const res = this.db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
    return res.changes;
  }
}
