import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';
import { posDatabase } from './db.js';

const MODULE = 'DatabaseMigrations';

class DatabaseMigrations {
  constructor() {
    this.migrationsDir = path.join(path.dirname(new URL(import.meta.url).pathname));
    this.schemaPath = path.join(this.migrationsDir, 'schema.sql');
    this.migrationTableName = 'schema_migrations';
    this.appliedMigrations = new Set();
  }

  async initialize() {
    try {
      // Ensure database is initialized
      if (!posDatabase.initialize()) {
        throw new Error('Failed to initialize database');
      }

      // Create migrations tracking table
      this.createMigrationTable();

      // Load applied migrations
      this.loadAppliedMigrations();

      // Run pending migrations
      await this.runPendingMigrations();

      logger.info(MODULE, 'Database migrations completed');
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to initialize migrations', { error: error.message });
      return false;
    }
  }

  createMigrationTable() {
    try {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${this.migrationTableName} (
          version TEXT PRIMARY KEY,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      posDatabase.db.exec(createTableSQL);
      logger.debug(MODULE, 'Migration tracking table created');
    } catch (error) {
      logger.error(MODULE, 'Failed to create migration table', { error: error.message });
      throw error;
    }
  }

  loadAppliedMigrations() {
    try {
      const stmt = posDatabase.db.prepare(`SELECT version FROM ${this.migrationTableName}`);
      const results = stmt.all();

      this.appliedMigrations.clear();
      results.forEach((row) => {
        this.appliedMigrations.add(row.version);
      });

      logger.debug(MODULE, 'Applied migrations loaded', { count: this.appliedMigrations.size });
    } catch (error) {
      logger.error(MODULE, 'Failed to load applied migrations', { error: error.message });
      // If table doesn't exist or other error, assume no migrations applied
      this.appliedMigrations.clear();
    }
  }

  async runPendingMigrations() {
    try {
      const migrations = this.getMigrations();
      let appliedCount = 0;

      for (const migration of migrations) {
        if (!this.appliedMigrations.has(migration.version)) {
          logger.info(MODULE, 'Applying migration', {
            version: migration.version,
            description: migration.description,
          });

          await this.applyMigration(migration);
          this.markMigrationAsApplied(migration.version);
          appliedCount++;
        }
      }

      if (appliedCount > 0) {
        logger.info(MODULE, 'Migrations applied', { count: appliedCount });
      } else {
        logger.debug(MODULE, 'No pending migrations');
      }
    } catch (error) {
      logger.error(MODULE, 'Failed to run pending migrations', { error: error.message });
      throw error;
    }
  }

  getMigrations() {
    try {
      const migrations = [
        {
          version: '001',
          description: 'Initial database schema',
          sql: this.loadSchemaSQL(),
        },
        {
          version: '002',
          description: 'Add indexes for better performance',
          sql: this.getIndexesSQL(),
        },
        {
          version: '003',
          description: 'Add triggers for updated_at timestamps',
          sql: this.getTriggersSQL(),
        },
      ];

      return migrations;
    } catch (error) {
      logger.error(MODULE, 'Failed to get migrations', { error: error.message });
      throw error;
    }
  }

  loadSchemaSQL() {
    try {
      if (!fs.existsSync(this.schemaPath)) {
        throw new Error(`Schema file not found: ${this.schemaPath}`);
      }

      const schemaSQL = fs.readFileSync(this.schemaPath, 'utf8');
      logger.debug(MODULE, 'Schema SQL loaded from file');
      return schemaSQL;
    } catch (error) {
      logger.error(MODULE, 'Failed to load schema SQL', { error: error.message });
      throw error;
    }
  }

  getIndexesSQL() {
    return `
      -- Additional indexes for performance optimization
      
      CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
      CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
      CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
      CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
      CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);
      CREATE INDEX IF NOT EXISTS idx_sales_invoices_status ON sales_invoices(status);
      CREATE INDEX IF NOT EXISTS idx_sales_invoices_name ON sales_invoices(name);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
      CREATE INDEX IF NOT EXISTS idx_invoice_items_item ON invoice_items(item_id);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at);
      CREATE INDEX IF NOT EXISTS idx_sync_log_queue ON sync_log(queue_id);
      CREATE INDEX IF NOT EXISTS idx_conflict_log_table ON conflict_log(table_name);
      CREATE INDEX IF NOT EXISTS idx_conflict_log_unresolved ON conflict_log(resolution) WHERE resolution IS NULL;
    `;
  }

  getTriggersSQL() {
    return `
      -- Triggers for automatic updated_at timestamp management
      
      DROP TRIGGER IF EXISTS customers_updated_at;
      CREATE TRIGGER customers_updated_at 
        AFTER UPDATE ON customers
        BEGIN
          UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      DROP TRIGGER IF EXISTS items_updated_at;
      CREATE TRIGGER items_updated_at 
        AFTER UPDATE ON items
        BEGIN
          UPDATE items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      DROP TRIGGER IF EXISTS sales_invoices_updated_at;
      CREATE TRIGGER sales_invoices_updated_at 
        AFTER UPDATE ON sales_invoices
        BEGIN
          UPDATE sales_invoices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;

      DROP TRIGGER IF EXISTS sync_queue_updated_at;
      CREATE TRIGGER sync_queue_updated_at 
        AFTER UPDATE ON sync_queue
        BEGIN
          UPDATE sync_queue SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END;
    `;
  }

  async applyMigration(migration) {
    try {
      const transaction = posDatabase.db.transaction((sql) => {
        // Split SQL into individual statements
        const statements = sql
          .split(';')
          .map((stmt) => stmt.trim())
          .filter((stmt) => stmt.length > 0);

        statements.forEach((statement) => {
          if (statement.length > 0) {
            posDatabase.db.exec(statement);
          }
        });
      });

      transaction(migration.sql);
      logger.debug(MODULE, 'Migration applied successfully', { version: migration.version });
    } catch (error) {
      logger.error(MODULE, 'Failed to apply migration', {
        version: migration.version,
        error: error.message,
      });
      throw error;
    }
  }

  markMigrationAsApplied(version) {
    try {
      const stmt = posDatabase.db.prepare(`
        INSERT INTO ${this.migrationTableName} (version) VALUES (?)
      `);
      stmt.run(version);
      this.appliedMigrations.add(version);

      logger.debug(MODULE, 'Migration marked as applied', { version });
    } catch (error) {
      logger.error(MODULE, 'Failed to mark migration as applied', {
        version,
        error: error.message,
      });
      throw error;
    }
  }

  // Helper method to reset database (for development/testing)
  async resetDatabase() {
    try {
      logger.warn(MODULE, 'Resetting database - all data will be lost!');

      // Drop all tables
      const tables = [
        'conflict_log',
        'sync_log',
        'sync_queue',
        'invoice_items',
        'sales_invoices',
        'items',
        'customers',
        this.migrationTableName,
      ];

      tables.forEach((table) => {
        posDatabase.db.exec(`DROP TABLE IF EXISTS ${table}`);
      });

      // Clear applied migrations
      this.appliedMigrations.clear();

      // Reinitialize
      await this.initialize();

      logger.info(MODULE, 'Database reset completed');
    } catch (error) {
      logger.error(MODULE, 'Failed to reset database', { error: error.message });
      throw error;
    }
  }

  // Get migration status
  getMigrationStatus() {
    try {
      const migrations = this.getMigrations();
      const status = {
        total: migrations.length,
        applied: this.appliedMigrations.size,
        pending: migrations.length - this.appliedMigrations.size,
        migrations: [],
      };

      migrations.forEach((migration) => {
        status.migrations.push({
          version: migration.version,
          description: migration.description,
          applied: this.appliedMigrations.has(migration.version),
        });
      });

      return status;
    } catch (error) {
      logger.error(MODULE, 'Failed to get migration status', { error: error.message });
      throw error;
    }
  }
}

export const databaseMigrations = new DatabaseMigrations();
