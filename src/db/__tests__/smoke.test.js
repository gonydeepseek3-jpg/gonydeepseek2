import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { DatabaseManager } from '../database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.join(__dirname, 'smoke-test.db');

class SmokeTestRunner {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  assert(condition, message) {
    if (condition) {
      this.passed++;
      console.log(`✓ ${message}`);
    } else {
      this.failed++;
      this.errors.push(message);
      console.error(`✗ ${message}`);
    }
  }

  async run() {
    console.log('Starting SQLite Data Layer Smoke Tests\n');

    try {
      await this.testDatabaseInitialization();
      await this.testInvoiceSchema();
      await this.testInvoiceOperations();
      await this.testCustomerSchema();
      await this.testCustomerOperations();
      await this.testQueueSchema();
      await this.testQueueOperations();
      await this.testSyncMetadataSchema();
      await this.testConflictSchema();
      await this.testErrorHandling();
      await this.testIntegrity();
      await this.testPersistence();
    } catch (error) {
      console.error(`Test suite error: ${error.message}`);
      this.failed++;
    }

    this.printResults();
    return this.failed === 0;
  }

  async testDatabaseInitialization() {
    console.log('\n--- Database Initialization Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });

    try {
      const db = dbManager.open();
      this.assert(db !== null, 'Database connection opened');

      dbManager.initialize();
      this.assert(dbManager.isInitialized, 'Database initialized');

      const tables = db.prepare(
        'SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name'
      ).all();

      const tableNames = tables.map(t => t.name);
      this.assert(tableNames.includes('invoices'), 'Invoices table created');
      this.assert(tableNames.includes('invoice_items'), 'Invoice items table created');
      this.assert(tableNames.includes('customers'), 'Customers table created');
      this.assert(tableNames.includes('queued_requests'), 'Queued requests table created');
      this.assert(tableNames.includes('sync_metadata'), 'Sync metadata table created');
      this.assert(tableNames.includes('conflict_logs'), 'Conflict logs table created');

      dbManager.close();
      this.assert(!dbManager.isInitialized, 'Database closed successfully');
    } catch (error) {
      this.assert(false, `Database initialization: ${error.message}`);
    }
  }

  async testInvoiceSchema() {
    console.log('\n--- Invoice Schema Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const db = dbManager.getDb();
      const schema = db.prepare(
        'PRAGMA table_info(invoices)'
      ).all();

      const columnNames = schema.map(col => col.name);
      this.assert(columnNames.includes('id'), 'Invoice: id column');
      this.assert(columnNames.includes('name'), 'Invoice: name column');
      this.assert(columnNames.includes('customer'), 'Invoice: customer column');
      this.assert(columnNames.includes('status'), 'Invoice: status column');
      this.assert(columnNames.includes('base_grand_total'), 'Invoice: base_grand_total column');
      this.assert(columnNames.includes('erpnext_data'), 'Invoice: erpnext_data column');
      this.assert(columnNames.includes('sync_status'), 'Invoice: sync_status column');
      this.assert(columnNames.includes('created_at'), 'Invoice: created_at column');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Invoice schema: ${error.message}`);
    }
  }

  async testInvoiceOperations() {
    console.log('\n--- Invoice CRUD Operations ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const repos = dbManager.createRepositories();
      const invoiceRepo = repos.invoices;

      const invoice = {
        id: 'TEST-INV-001',
        name: 'TEST-INV-001',
        customer: 'CUST-001',
        customer_name: 'Test Customer',
        status: 'Draft',
        doctype: 'Sales Invoice',
        base_grand_total: 5000,
        sync_status: 'pending',
      };

      const createResult = invoiceRepo.create(invoice);
      this.assert(createResult.changes > 0, 'Invoice: Create operation');

      const found = invoiceRepo.findById('TEST-INV-001');
      this.assert(found !== null, 'Invoice: Find by ID');
      this.assert(found.name === 'TEST-INV-001', 'Invoice: Data integrity after create');
      this.assert(found.base_grand_total === 5000, 'Invoice: Numeric field serialization');

      const updateResult = invoiceRepo.update('TEST-INV-001', { status: 'Submitted' });
      this.assert(updateResult.changes > 0, 'Invoice: Update operation');

      const updated = invoiceRepo.findById('TEST-INV-001');
      this.assert(updated.status === 'Submitted', 'Invoice: Data integrity after update');

      const deleteResult = invoiceRepo.delete('TEST-INV-001');
      this.assert(deleteResult.changes > 0, 'Invoice: Delete operation');

      const deleted = invoiceRepo.findById('TEST-INV-001');
      this.assert(deleted === null, 'Invoice: Verified deletion');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Invoice operations: ${error.message}`);
    }
  }

  async testCustomerSchema() {
    console.log('\n--- Customer Schema Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const db = dbManager.getDb();
      const schema = db.prepare(
        'PRAGMA table_info(customers)'
      ).all();

      const columnNames = schema.map(col => col.name);
      this.assert(columnNames.includes('id'), 'Customer: id column');
      this.assert(columnNames.includes('name'), 'Customer: name column');
      this.assert(columnNames.includes('customer_name'), 'Customer: customer_name column');
      this.assert(columnNames.includes('email'), 'Customer: email column');
      this.assert(columnNames.includes('phone'), 'Customer: phone column');
      this.assert(columnNames.includes('credit_limit'), 'Customer: credit_limit column');
      this.assert(columnNames.includes('disabled'), 'Customer: disabled column');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Customer schema: ${error.message}`);
    }
  }

  async testCustomerOperations() {
    console.log('\n--- Customer CRUD Operations ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const repos = dbManager.createRepositories();
      const customerRepo = repos.customers;

      const customer = {
        id: 'TEST-CUST-001',
        name: 'TEST-CUST-001',
        customer_name: 'Test Business Inc',
        email: 'test@business.com',
        phone: '+1234567890',
        doctype: 'Customer',
      };

      const createResult = customerRepo.create(customer);
      this.assert(createResult.changes > 0, 'Customer: Create operation');

      const found = customerRepo.findById('TEST-CUST-001');
      this.assert(found !== null, 'Customer: Find by ID');
      this.assert(found.email === 'test@business.com', 'Customer: Email field');

      const byEmail = customerRepo.findByEmail('test@business.com');
      this.assert(byEmail !== null, 'Customer: Find by email');

      const searchResults = customerRepo.search('test');
      this.assert(searchResults.length > 0, 'Customer: Search functionality');

      const count = customerRepo.count();
      this.assert(count === 1, 'Customer: Count operation');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Customer operations: ${error.message}`);
    }
  }

  async testQueueSchema() {
    console.log('\n--- Queue Schema Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const db = dbManager.getDb();
      const schema = db.prepare(
        'PRAGMA table_info(queued_requests)'
      ).all();

      const columnNames = schema.map(col => col.name);
      this.assert(columnNames.includes('id'), 'Queue: id column');
      this.assert(columnNames.includes('entity_type'), 'Queue: entity_type column');
      this.assert(columnNames.includes('operation'), 'Queue: operation column');
      this.assert(columnNames.includes('payload'), 'Queue: payload column');
      this.assert(columnNames.includes('status'), 'Queue: status column');
      this.assert(columnNames.includes('priority'), 'Queue: priority column');
      this.assert(columnNames.includes('retry_count'), 'Queue: retry_count column');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Queue schema: ${error.message}`);
    }
  }

  async testQueueOperations() {
    console.log('\n--- Queue CRUD Operations ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const repos = dbManager.createRepositories();
      const queueRepo = repos.queue;

      const request = {
        id: 'TEST-REQ-001',
        entity_type: 'invoice',
        entity_id: 'TEST-INV-001',
        operation: 'insert',
        request_type: 'create',
        payload: { test: 'data' },
        status: 'pending',
        priority: 5,
      };

      const createResult = queueRepo.create(request);
      this.assert(createResult.changes > 0, 'Queue: Create operation');

      const found = queueRepo.findById('TEST-REQ-001');
      this.assert(found !== null, 'Queue: Find by ID');
      this.assert(found.status === 'pending', 'Queue: Initial status');

      const pending = queueRepo.findPending();
      this.assert(pending.length > 0, 'Queue: Find pending');

      queueRepo.markAsProcessing('TEST-REQ-001');
      const processing = queueRepo.findById('TEST-REQ-001');
      this.assert(processing.status === 'processing', 'Queue: Mark as processing');

      queueRepo.markAsCompleted('TEST-REQ-001', { result: 'success' });
      const completed = queueRepo.findById('TEST-REQ-001');
      this.assert(completed.status === 'completed', 'Queue: Mark as completed');
      this.assert(completed.processed_at !== null, 'Queue: Processed timestamp');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Queue operations: ${error.message}`);
    }
  }

  async testSyncMetadataSchema() {
    console.log('\n--- Sync Metadata Schema Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const db = dbManager.getDb();
      const schema = db.prepare(
        'PRAGMA table_info(sync_metadata)'
      ).all();

      const columnNames = schema.map(col => col.name);
      this.assert(columnNames.includes('entity_type'), 'Sync metadata: entity_type column');
      this.assert(columnNames.includes('last_sync_time'), 'Sync metadata: last_sync_time column');
      this.assert(columnNames.includes('sync_token'), 'Sync metadata: sync_token column');
      this.assert(columnNames.includes('is_initial_sync_done'), 'Sync metadata: is_initial_sync_done column');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Sync metadata schema: ${error.message}`);
    }
  }

  async testConflictSchema() {
    console.log('\n--- Conflict Log Schema Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const db = dbManager.getDb();
      const schema = db.prepare(
        'PRAGMA table_info(conflict_logs)'
      ).all();

      const columnNames = schema.map(col => col.name);
      this.assert(columnNames.includes('conflict_type'), 'Conflict: conflict_type column');
      this.assert(columnNames.includes('entity_type'), 'Conflict: entity_type column');
      this.assert(columnNames.includes('local_data'), 'Conflict: local_data column');
      this.assert(columnNames.includes('remote_data'), 'Conflict: remote_data column');
      this.assert(columnNames.includes('resolution_status'), 'Conflict: resolution_status column');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Conflict schema: ${error.message}`);
    }
  }

  async testErrorHandling() {
    console.log('\n--- Error Handling Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const repos = dbManager.createRepositories();
      const invoiceRepo = repos.invoices;

      const found = invoiceRepo.findById('NONEXISTENT');
      this.assert(found === null, 'Error handling: Graceful null return for missing data');

      invoiceRepo.create({
        id: 'TEST-INV-002',
        name: 'TEST-INV-002',
        customer: 'CUST-001',
      });

      const count = invoiceRepo.count({ customer: 'CUST-001' });
      this.assert(count === 1, 'Error handling: Correct count with filters');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Error handling: ${error.message}`);
    }
  }

  async testIntegrity() {
    console.log('\n--- Integrity Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const dbManager = new DatabaseManager({ filePath: testDbPath });
    dbManager.open();
    dbManager.initialize();

    try {
      const isIntact = dbManager.checkDatabaseIntegrity();
      this.assert(isIntact, 'Database integrity check passed');

      const stats = dbManager.getStats();
      this.assert(Object.prototype.hasOwnProperty.call(stats, 'invoices'), 'Stats: Has invoices count');
      this.assert(Object.prototype.hasOwnProperty.call(stats, 'customers'), 'Stats: Has customers count');
      this.assert(Object.prototype.hasOwnProperty.call(stats, 'queued_requests'), 'Stats: Has queue count');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Integrity: ${error.message}`);
    }
  }

  async testPersistence() {
    console.log('\n--- Persistence Tests ---');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    try {
      let dbManager = new DatabaseManager({ filePath: testDbPath });
      dbManager.open();
      dbManager.initialize();

      const repos = dbManager.createRepositories();
      const invoiceRepo = repos.invoices;

      invoiceRepo.create({
        id: 'PERSIST-001',
        name: 'PERSIST-001',
        customer: 'CUST-001',
        base_grand_total: 9999,
      });

      dbManager.close();

      dbManager = new DatabaseManager({ filePath: testDbPath });
      dbManager.open();
      dbManager.initialize();

      const repos2 = dbManager.createRepositories();
      const invoiceRepo2 = repos2.invoices;

      const found = invoiceRepo2.findById('PERSIST-001');
      this.assert(found !== null, 'Persistence: Data survives reconnection');
      this.assert(found.base_grand_total === 9999, 'Persistence: Data integrity maintained');

      dbManager.close();
    } catch (error) {
      this.assert(false, `Persistence: ${error.message}`);
    }
  }

  printResults() {
    console.log('\n========================================');
    console.log('Smoke Test Results');
    console.log('========================================');
    console.log(`✓ Passed: ${this.passed}`);
    console.log(`✗ Failed: ${this.failed}`);
    console.log(`Total: ${this.passed + this.failed}`);

    if (this.failed > 0) {
      console.log('\nFailed Tests:');
      this.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    } else {
      console.log('\n✓ All tests passed!');
    }
    console.log('========================================\n');
  }
}

async function runTests() {
  const runner = new SmokeTestRunner();
  const success = await runner.run();
  process.exit(success ? 0 : 1);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
