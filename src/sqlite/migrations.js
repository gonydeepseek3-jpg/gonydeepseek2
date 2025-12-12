import crypto from 'crypto';

const MODULE = 'SQLiteMigrations';

function tableExists(db, tableName) {
  const stmt = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name = ?"
  );
  return Boolean(stmt.get(tableName));
}

function getCurrentVersion(db) {
  if (!tableExists(db, 'schema_migrations')) {
    return 0;
  }

  const row = db
    .prepare('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')
    .get();
  return row?.version || 0;
}

function setVersion(db, version) {
  db.prepare(
    'INSERT INTO schema_migrations (version, applied_at) VALUES (?, CURRENT_TIMESTAMP)'
  ).run(version);
}

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function migrateLegacyTableNames(db) {
  if (tableExists(db, 'offline_requests') && !tableExists(db, 'sync_queue')) {
    db.exec('ALTER TABLE offline_requests RENAME TO sync_queue;');
  }

  if (tableExists(db, 'sync_conflicts') && !tableExists(db, 'conflict_log')) {
    db.exec('ALTER TABLE sync_conflicts RENAME TO conflict_log;');
  }
}

function migrationV1(db) {
  migrateLegacyTableNames(db);

  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      method TEXT NOT NULL,
      url TEXT NOT NULL,
      headers TEXT,
      body TEXT,
      request_hash TEXT UNIQUE,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      next_retry_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT,
      resource_id TEXT,
      resource_type TEXT,
      resource_version TEXT
    );

    CREATE TABLE IF NOT EXISTS request_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_hash TEXT UNIQUE NOT NULL,
      response_data TEXT,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conflict_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource_id TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      local_request_id INTEGER,
      local_data TEXT,
      server_data TEXT,
      server_version TEXT,
      conflict_type TEXT,
      resolution_status TEXT DEFAULT 'pending',
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (local_request_id) REFERENCES sync_queue(id)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_id INTEGER,
      event_type TEXT NOT NULL,
      message TEXT,
      meta TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (queue_id) REFERENCES sync_queue(id)
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    /* Domain tables for offline-first POS caching */

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      modified_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      modified_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales_invoices (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      data TEXT NOT NULL,
      modified_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id TEXT NOT NULL,
      item_id TEXT,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id),
      FOREIGN KEY (item_id) REFERENCES items(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_url ON sync_queue(url);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_next_retry ON sync_queue(next_retry_at);

    CREATE INDEX IF NOT EXISTS idx_conflict_log_resource ON conflict_log(resource_id, resource_type);
    CREATE INDEX IF NOT EXISTS idx_conflict_log_status ON conflict_log(resolution_status);

    CREATE INDEX IF NOT EXISTS idx_sync_log_queue_id ON sync_log(queue_id);
    CREATE INDEX IF NOT EXISTS idx_sync_log_event_type ON sync_log(event_type);

    CREATE INDEX IF NOT EXISTS idx_customers_modified_at ON customers(modified_at);
    CREATE INDEX IF NOT EXISTS idx_items_modified_at ON items(modified_at);
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_modified_at ON sales_invoices(modified_at);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
  `);

  // Ensure any legacy rows can still be deduplicated even if they didn't have a hash
  if (tableExists(db, 'sync_queue')) {
    const hasNullHashes = db
      .prepare('SELECT COUNT(*) as c FROM sync_queue WHERE request_hash IS NULL')
      .get().c;

    if (hasNullHashes > 0) {
      const rows = db
        .prepare('SELECT id, method, url, body FROM sync_queue WHERE request_hash IS NULL')
        .all();

      const update = db.prepare('UPDATE sync_queue SET request_hash = ? WHERE id = ?');
      const tx = db.transaction((itemsToUpdate) => {
        for (const row of itemsToUpdate) {
          const content = `${row.method}:${row.url}:${row.body || ''}`;
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          update.run(hash, row.id);
        }
      });

      tx(rows);
    }
  }
}

const migrations = [{ version: 1, up: migrationV1 }];

export function applyMigrations(db, _logger = null) {
  ensureMigrationsTable(db);

  const current = getCurrentVersion(db);

  for (const migration of migrations) {
    if (migration.version > current) {
      _logger?.info?.(MODULE, 'Applying migration', { version: migration.version });
      migration.up(db);
      setVersion(db, migration.version);
    }
  }
}

export function getLatestSchemaVersion() {
  return migrations[migrations.length - 1]?.version || 0;
}
