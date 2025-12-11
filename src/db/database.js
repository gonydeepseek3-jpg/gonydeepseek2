import Database from 'better-sqlite3';
import path from 'path';
import { copyFileSync } from 'fs';
import { Migrator } from './migrations.js';
import { InvoiceRepository } from './repositories/invoiceRepository.js';
import { InvoiceItemRepository } from './repositories/invoiceItemRepository.js';
import { CustomerRepository } from './repositories/customerRepository.js';
import { QueueRepository } from './repositories/queueRepository.js';
import { SyncMetadataRepository } from './repositories/syncMetadataRepository.js';
import { ConflictLogRepository } from './repositories/conflictLogRepository.js';

export class DatabaseManager {
  constructor(options = {}) {
    this.options = {
      filePath: options.filePath || this.getDefaultDbPath(),
      readonly: options.readonly || false,
      timeout: options.timeout || 5000,
      ...options,
    };
    this.db = null;
    this.isInitialized = false;
  }

  getDefaultDbPath() {
    // Use environment variable if set, otherwise use default path
    if (process.env.DB_PATH) {
      return process.env.DB_PATH;
    }

    // When running in electron, userData will be set
    // When running in Node, use current directory
    const userDataPath = process.env.ELECTRON_USER_DATA 
      || process.env.HOME
      || process.env.APPDATA
      || path.join(process.cwd(), 'data');
    
    return path.join(userDataPath, 'posawsome.db');
  }

  open() {
    try {
      this.db = new Database(this.options.filePath, {
        readonly: this.options.readonly,
        timeout: this.options.timeout,
      });

      this.db.pragma('journal_mode = WAL');
      this.db.pragma('synchronous = NORMAL');
      this.db.pragma('foreign_keys = ON');
      this.db.pragma('temp_store = MEMORY');

      return this.db;
    } catch (error) {
      throw new Error(`Failed to open database: ${error.message}`);
    }
  }

  initialize() {
    if (this.isInitialized) {
      return;
    }

    if (!this.db) {
      this.open();
    }

    try {
      const migrator = new Migrator(this.db);
      migrator.initialize();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  getDb() {
    if (!this.db) {
      this.open();
    }
    return this.db;
  }

  createRepositories() {
    return {
      invoices: new InvoiceRepository(this.db),
      invoiceItems: new InvoiceItemRepository(this.db),
      customers: new CustomerRepository(this.db),
      queue: new QueueRepository(this.db),
      syncMetadata: new SyncMetadataRepository(this.db),
      conflicts: new ConflictLogRepository(this.db),
    };
  }

  checkDatabaseIntegrity() {
    try {
      const result = this.db.prepare('PRAGMA integrity_check').get();
      return result.integrity_check === 'ok';
    } catch (error) {
      return false;
    }
  }

  repair() {
    try {
      if (!this.checkDatabaseIntegrity()) {
        console.warn('Database integrity check failed, attempting repair...');
        this.db.exec('PRAGMA integrity_check');
      }
    } catch (error) {
      throw new Error(`Database repair failed: ${error.message}`);
    }
  }

  vacuum() {
    try {
      this.db.exec('VACUUM');
    } catch (error) {
      throw new Error(`Database vacuum failed: ${error.message}`);
    }
  }

  backup(backupPath) {
    try {
      if (!this.db) {
        throw new Error('Database is not open');
      }
      const backupDb = new Database(backupPath);
      this.db.backup(backupDb);
      backupDb.close();
    } catch (error) {
      throw new Error(`Database backup failed: ${error.message}`);
    }
  }

  restoreFromBackup(backupPath) {
    try {
      this.close();
      copyFileSync(backupPath, this.options.filePath);
      this.open();
      this.initialize();
    } catch (error) {
      throw new Error(`Database restore failed: ${error.message}`);
    }
  }

  transaction(callback) {
    const transaction = this.db.transaction(callback);
    return transaction();
  }

  getStats() {
    const stats = {};
    try {
      const tables = [
        'invoices',
        'invoice_items',
        'customers',
        'queued_requests',
        'sync_metadata',
        'conflict_logs',
      ];

      for (const table of tables) {
        try {
          const result = this.db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
          stats[table] = result.count;
        } catch {
          stats[table] = 0;
        }
      }
    } catch (error) {
      console.error('Failed to get database stats:', error);
    }
    return stats;
  }
}

export { InvoiceRepository, InvoiceItemRepository, CustomerRepository, QueueRepository, SyncMetadataRepository, ConflictLogRepository };
