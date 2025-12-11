import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { DatabaseManager } from '../database.js';
import { InvoiceRepository } from '../repositories/invoiceRepository.js';
import { CustomerRepository } from '../repositories/customerRepository.js';
import { QueueRepository } from '../repositories/queueRepository.js';
import { ConflictLogRepository } from '../repositories/conflictLogRepository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(__dirname, 'test.db');

describe('DatabaseManager', () => {
  let dbManager;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager({ filePath: testDbPath });
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should open database connection', () => {
    const db = dbManager.open();
    expect(db).toBeDefined();
    expect(db).toBeInstanceOf(Database);
  });

  it('should initialize database with migrations', () => {
    dbManager.open();
    dbManager.initialize();

    const db = dbManager.getDb();
    const tables = db.prepare(
      'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name'
    ).all();

    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('invoices');
    expect(tableNames).toContain('invoice_items');
    expect(tableNames).toContain('customers');
    expect(tableNames).toContain('queued_requests');
    expect(tableNames).toContain('sync_metadata');
    expect(tableNames).toContain('conflict_logs');
  });

  it('should close database connection', () => {
    dbManager.open();
    dbManager.close();
    expect(dbManager.db).toBeNull();
  });

  it('should create repositories', () => {
    dbManager.open();
    dbManager.initialize();

    const repos = dbManager.createRepositories();
    expect(repos.invoices).toBeInstanceOf(InvoiceRepository);
    expect(repos.invoiceItems).toBeDefined();
    expect(repos.customers).toBeInstanceOf(CustomerRepository);
    expect(repos.queue).toBeInstanceOf(QueueRepository);
    expect(repos.syncMetadata).toBeDefined();
    expect(repos.conflicts).toBeInstanceOf(ConflictLogRepository);
  });

  it('should check database integrity', () => {
    dbManager.open();
    dbManager.initialize();

    const isIntact = dbManager.checkDatabaseIntegrity();
    expect(isIntact).toBe(true);
  });

  it('should get database stats', () => {
    dbManager.open();
    dbManager.initialize();

    const stats = dbManager.getStats();
    expect(stats).toHaveProperty('invoices');
    expect(stats).toHaveProperty('customers');
    expect(stats).toHaveProperty('queued_requests');
  });

  it('should execute transaction', () => {
    dbManager.open();
    dbManager.initialize();

    const result = dbManager.transaction(() => {
      return 'transaction executed';
    });

    expect(result).toBe('transaction executed');
  });
});

describe('InvoiceRepository', () => {
  let dbManager;
  let invoiceRepo;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();
    invoiceRepo = dbManager.createRepositories().invoices;
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create an invoice', () => {
    const invoice = {
      id: 'INV-001',
      name: 'INV-001',
      customer: 'CUST-001',
      customer_name: 'Test Customer',
      status: 'Draft',
      doctype: 'Sales Invoice',
      base_grand_total: 1000,
    };

    const result = invoiceRepo.create(invoice);
    expect(result.changes).toBeGreaterThan(0);

    const retrieved = invoiceRepo.findById('INV-001');
    expect(retrieved).toBeDefined();
    expect(retrieved.name).toBe('INV-001');
    expect(retrieved.customer).toBe('CUST-001');
  });

  it('should update an invoice', () => {
    const invoice = {
      id: 'INV-002',
      name: 'INV-002',
      customer: 'CUST-001',
      status: 'Draft',
      base_grand_total: 1000,
    };

    invoiceRepo.create(invoice);

    const updates = {
      status: 'Submitted',
      base_grand_total: 1100,
    };

    invoiceRepo.update('INV-002', updates);

    const updated = invoiceRepo.findById('INV-002');
    expect(updated.status).toBe('Submitted');
    expect(updated.base_grand_total).toBe(1100);
  });

  it('should find invoices by customer', () => {
    invoiceRepo.create({
      id: 'INV-003',
      name: 'INV-003',
      customer: 'CUST-002',
      status: 'Draft',
    });

    invoiceRepo.create({
      id: 'INV-004',
      name: 'INV-004',
      customer: 'CUST-002',
      status: 'Submitted',
    });

    invoiceRepo.create({
      id: 'INV-005',
      name: 'INV-005',
      customer: 'CUST-003',
      status: 'Draft',
    });

    const result = invoiceRepo.findByCustomer('CUST-002');
    expect(result.length).toBe(2);
    expect(result.every(inv => inv.customer === 'CUST-002')).toBe(true);
  });

  it('should delete an invoice', () => {
    invoiceRepo.create({
      id: 'INV-006',
      name: 'INV-006',
      customer: 'CUST-001',
      status: 'Draft',
    });

    invoiceRepo.delete('INV-006');

    const retrieved = invoiceRepo.findById('INV-006');
    expect(retrieved).toBeNull();
  });

  it('should count invoices', () => {
    invoiceRepo.create({ id: 'INV-007', name: 'INV-007', customer: 'CUST-001' });
    invoiceRepo.create({ id: 'INV-008', name: 'INV-008', customer: 'CUST-001' });
    invoiceRepo.create({ id: 'INV-009', name: 'INV-009', customer: 'CUST-002' });

    const totalCount = invoiceRepo.count();
    expect(totalCount).toBe(3);

    const custCount = invoiceRepo.count({ customer: 'CUST-001' });
    expect(custCount).toBe(2);
  });

  it('should update sync status', () => {
    invoiceRepo.create({
      id: 'INV-010',
      name: 'INV-010',
      customer: 'CUST-001',
      sync_status: 'pending',
    });

    invoiceRepo.updateSyncStatus('INV-010', 'synced');

    const updated = invoiceRepo.findById('INV-010');
    expect(updated.sync_status).toBe('synced');
  });

  it('should upsert invoice (create if not exists)', () => {
    const invoice = {
      id: 'INV-011',
      name: 'INV-011',
      customer: 'CUST-001',
      base_grand_total: 500,
    };

    invoiceRepo.upsert(invoice);
    let result = invoiceRepo.findById('INV-011');
    expect(result.base_grand_total).toBe(500);

    invoice.base_grand_total = 600;
    invoiceRepo.upsert(invoice);
    result = invoiceRepo.findById('INV-011');
    expect(result.base_grand_total).toBe(600);
  });
});

describe('CustomerRepository', () => {
  let dbManager;
  let customerRepo;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();
    customerRepo = dbManager.createRepositories().customers;
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create a customer', () => {
    const customer = {
      id: 'CUST-001',
      name: 'CUST-001',
      customer_name: 'John Doe',
      email: 'john@example.com',
      doctype: 'Customer',
    };

    const result = customerRepo.create(customer);
    expect(result.changes).toBeGreaterThan(0);

    const retrieved = customerRepo.findById('CUST-001');
    expect(retrieved).toBeDefined();
    expect(retrieved.customer_name).toBe('John Doe');
  });

  it('should find customer by email', () => {
    customerRepo.create({
      id: 'CUST-002',
      name: 'CUST-002',
      customer_name: 'Jane Doe',
      email: 'jane@example.com',
    });

    const result = customerRepo.findByEmail('jane@example.com');
    expect(result).toBeDefined();
    expect(result.customer_name).toBe('Jane Doe');
  });

  it('should search customers', () => {
    customerRepo.create({
      id: 'CUST-003',
      name: 'CUST-003',
      customer_name: 'Acme Corp',
      email: 'contact@acme.com',
    });

    customerRepo.create({
      id: 'CUST-004',
      name: 'CUST-004',
      customer_name: 'Test Business',
      email: 'info@test.com',
    });

    const results = customerRepo.search('acme');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(c => c.customer_name === 'Acme Corp')).toBe(true);
  });

  it('should disable customer', () => {
    customerRepo.create({
      id: 'CUST-005',
      name: 'CUST-005',
      customer_name: 'Old Customer',
    });

    customerRepo.disable('CUST-005');

    const result = customerRepo.findById('CUST-005');
    expect(result.disabled).toBe(true);
  });
});

describe('QueueRepository', () => {
  let dbManager;
  let queueRepo;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();
    queueRepo = dbManager.createRepositories().queue;
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should create a queued request', () => {
    const request = {
      id: 'REQ-001',
      entity_type: 'invoice',
      entity_id: 'INV-001',
      operation: 'insert',
      payload: { name: 'INV-001' },
      status: 'pending',
    };

    const result = queueRepo.create(request);
    expect(result.changes).toBeGreaterThan(0);

    const retrieved = queueRepo.findById('REQ-001');
    expect(retrieved).toBeDefined();
    expect(retrieved.status).toBe('pending');
  });

  it('should find pending requests', () => {
    queueRepo.create({
      id: 'REQ-002',
      entity_type: 'invoice',
      entity_id: 'INV-002',
      operation: 'insert',
      payload: {},
      status: 'pending',
    });

    queueRepo.create({
      id: 'REQ-003',
      entity_type: 'customer',
      entity_id: 'CUST-001',
      operation: 'update',
      payload: {},
      status: 'completed',
    });

    const results = queueRepo.findPending();
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('REQ-002');
  });

  it('should update request status', () => {
    queueRepo.create({
      id: 'REQ-004',
      entity_type: 'invoice',
      entity_id: 'INV-004',
      operation: 'insert',
      payload: {},
      status: 'pending',
    });

    queueRepo.markAsCompleted('REQ-004', { success: true });

    const updated = queueRepo.findById('REQ-004');
    expect(updated.status).toBe('completed');
  });

  it('should increment retry count', () => {
    queueRepo.create({
      id: 'REQ-005',
      entity_type: 'invoice',
      entity_id: 'INV-005',
      operation: 'insert',
      payload: {},
      status: 'pending',
      retry_count: 0,
    });

    queueRepo.incrementRetryCount('REQ-005');

    const updated = queueRepo.findById('REQ-005');
    expect(updated.retry_count).toBe(1);
  });
});

describe('ConflictLogRepository', () => {
  let dbManager;
  let conflictRepo;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();
    conflictRepo = dbManager.createRepositories().conflicts;
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  it('should log a conflict', () => {
    const result = conflictRepo.logConflict(
      'version_mismatch',
      'invoice',
      'INV-001',
      { version: 1 },
      { version: 2 },
      'Version conflict'
    );

    expect(result.changes).toBeGreaterThan(0);
  });

  it('should find pending conflicts', () => {
    conflictRepo.logConflict('version_mismatch', 'invoice', 'INV-001', {}, {});
    conflictRepo.logConflict('version_mismatch', 'invoice', 'INV-002', {}, {});

    const pending = conflictRepo.findPending();
    expect(pending.length).toBe(2);
    expect(pending.every(c => c.resolution_status === 'pending')).toBe(true);
  });

  it('should resolve a conflict', () => {
    conflictRepo.logConflict('version_mismatch', 'invoice', 'INV-003', {}, {});
    const conflicts = conflictRepo.findPending();
    const conflictId = conflicts[0].id;

    conflictRepo.resolve(conflictId, { merged: true }, 'manual_merge', 'user@example.com', 'Resolved manually');

    const resolved = conflictRepo.findById(conflictId);
    expect(resolved.resolution_status).toBe('resolved');
    expect(resolved.resolution_method).toBe('manual_merge');
  });

  it('should get unresolved conflicts', () => {
    conflictRepo.logConflict('version_mismatch', 'invoice', 'INV-004', {}, {});
    conflictRepo.logConflict('concurrent_edit', 'customer', 'CUST-001', {}, {});

    const unresolved = conflictRepo.getUnresolvedConflicts();
    expect(unresolved.length).toBe(2);
  });
});
