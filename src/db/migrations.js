import { TABLES } from './constants.js';
import { getCreateTableSQL, getCreateIndexesSQL } from './schema.js';

export class Migrator {
  constructor(db) {
    this.db = db;
  }

  initialize() {
    try {
      this.createMigrationsTable();
      this.runPendingMigrations();
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error.message}`);
    }
  }

  createMigrationsTable() {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        batch INTEGER NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    this.db.exec(sql);
  }

  runPendingMigrations() {
    const migrations = this.getPendingMigrations();
    const currentBatch = this.getCurrentBatch() + 1;

    for (const migration of migrations) {
      try {
        migration.up(this.db);
        this.recordMigration(migration.name, currentBatch);
      } catch (error) {
        throw new Error(`Migration failed: ${migration.name} - ${error.message}`);
      }
    }
  }

  getPendingMigrations() {
    const executed = this.getExecutedMigrations();
    return MIGRATIONS.filter(m => !executed.includes(m.name));
  }

  getExecutedMigrations() {
    try {
      const rows = this.db.prepare(
        'SELECT name FROM migrations ORDER BY batch ASC, executed_at ASC'
      ).all();
      return rows.map(r => r.name);
    } catch (error) {
      // Table might not exist yet
      return [];
    }
  }

  getCurrentBatch() {
    try {
      const row = this.db.prepare('SELECT MAX(batch) as batch FROM migrations').get();
      return row && row.batch ? row.batch : 0;
    } catch (error) {
      return 0;
    }
  }

  recordMigration(name, batch) {
    this.db.prepare(
      'INSERT INTO migrations (name, batch) VALUES (?, ?)'
    ).run(name, batch);
  }

  rollback() {
    const batch = this.getCurrentBatch();
    if (batch === 0) {
      throw new Error('No migrations to rollback');
    }

    const executed = this.db.prepare(
      'SELECT name FROM migrations WHERE batch = ? ORDER BY executed_at DESC'
    ).all(batch);

    for (const row of executed) {
      const migration = MIGRATIONS.find(m => m.name === row.name);
      if (migration && migration.down) {
        migration.down(this.db);
        this.db.prepare('DELETE FROM migrations WHERE name = ?').run(row.name);
      }
    }
  }
}

export const MIGRATIONS = [
  {
    name: '001_create_invoices_table',
    up: (db) => {
      db.exec(getCreateTableSQL(TABLES.INVOICES));
      getCreateIndexesSQL(TABLES.INVOICES).forEach(sql => db.exec(sql));
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS ${TABLES.INVOICES}`);
    },
  },
  {
    name: '002_create_invoice_items_table',
    up: (db) => {
      db.exec(getCreateTableSQL(TABLES.INVOICE_ITEMS));
      getCreateIndexesSQL(TABLES.INVOICE_ITEMS).forEach(sql => db.exec(sql));
      // Add foreign key constraint
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS invoice_items_fk_insert
        BEFORE INSERT ON ${TABLES.INVOICE_ITEMS}
        BEGIN
          SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ${TABLES.INVOICES} WHERE id = NEW.invoice_id)
            THEN RAISE(ABORT, 'Foreign key constraint failed: invoice_id does not exist')
          END;
        END
      `);
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS ${TABLES.INVOICE_ITEMS}`);
      db.exec('DROP TRIGGER IF EXISTS invoice_items_fk_insert');
    },
  },
  {
    name: '003_create_customers_table',
    up: (db) => {
      db.exec(getCreateTableSQL(TABLES.CUSTOMERS));
      getCreateIndexesSQL(TABLES.CUSTOMERS).forEach(sql => db.exec(sql));
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS ${TABLES.CUSTOMERS}`);
    },
  },
  {
    name: '004_create_queued_requests_table',
    up: (db) => {
      db.exec(getCreateTableSQL(TABLES.QUEUED_REQUESTS));
      getCreateIndexesSQL(TABLES.QUEUED_REQUESTS).forEach(sql => db.exec(sql));
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS ${TABLES.QUEUED_REQUESTS}`);
    },
  },
  {
    name: '005_create_sync_metadata_table',
    up: (db) => {
      db.exec(getCreateTableSQL(TABLES.SYNC_METADATA));
      getCreateIndexesSQL(TABLES.SYNC_METADATA).forEach(sql => db.exec(sql));
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS ${TABLES.SYNC_METADATA}`);
    },
  },
  {
    name: '006_create_conflict_logs_table',
    up: (db) => {
      db.exec(getCreateTableSQL(TABLES.CONFLICT_LOGS));
      getCreateIndexesSQL(TABLES.CONFLICT_LOGS).forEach(sql => db.exec(sql));
    },
    down: (db) => {
      db.exec(`DROP TABLE IF EXISTS ${TABLES.CONFLICT_LOGS}`);
    },
  },
];
