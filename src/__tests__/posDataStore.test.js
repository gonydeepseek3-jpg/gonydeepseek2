import { describe, it, expect } from 'vitest';
import { openDatabase } from '../sqlite/openDatabase.js';
import { PosDataStore } from '../sqlite/posDataStore.js';

describe('PosDataStore', () => {
  it('should perform CRUD for customers and items', () => {
    const db = openDatabase(':memory:');
    const store = new PosDataStore(db);

    store.upsertCustomer('CUST-001', { name: 'Customer 1' }, '2025-01-01T00:00:00Z');
    store.upsertItem('ITEM-001', { name: 'Item 1', price: 10 }, '2025-01-01T00:00:00Z');

    const customer = store.getCustomer('CUST-001');
    expect(customer).toBeTruthy();
    expect(customer.id).toBe('CUST-001');
    expect(customer.data.name).toBe('Customer 1');

    const item = store.getItem('ITEM-001');
    expect(item).toBeTruthy();
    expect(item.data.price).toBe(10);

    store.upsertCustomer('CUST-001', { name: 'Customer 1 updated' }, '2025-01-02T00:00:00Z');
    const updated = store.getCustomer('CUST-001');
    expect(updated.data.name).toBe('Customer 1 updated');

    expect(store.deleteItem('ITEM-001')).toBe(true);
    expect(store.getItem('ITEM-001')).toBeNull();
  });

  it('should store sales invoices and invoice items', () => {
    const db = openDatabase(':memory:');
    const store = new PosDataStore(db);

    store.upsertCustomer('CUST-001', { name: 'Customer 1' });
    store.upsertItem('ITEM-001', { name: 'Item 1' });

    store.upsertSalesInvoice(
      'INV-001',
      'CUST-001',
      { name: 'INV-001', customer: 'CUST-001', grand_total: 100 },
      '2025-01-03T00:00:00Z'
    );

    const invoiceId = store.addInvoiceItem('INV-001', 'ITEM-001', {
      item_code: 'ITEM-001',
      qty: 2,
      rate: 50,
    });

    expect(invoiceId).toBeTruthy();

    const invoice = store.getSalesInvoice('INV-001');
    expect(invoice.customer_id).toBe('CUST-001');
    expect(invoice.data.grand_total).toBe(100);

    const items = store.getInvoiceItems('INV-001');
    expect(items.length).toBe(1);
    expect(items[0].data.qty).toBe(2);
  });
});
