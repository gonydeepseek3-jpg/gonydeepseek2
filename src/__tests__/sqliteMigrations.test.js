import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { applyMigrations } from '../sqlite/migrations.js';

function listTables(db) {
  return db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all()
    .map((r) => r.name);
}

describe('SQLite migrations', () => {
  it('should create required tables', () => {
    const db = new Database(':memory:');
    applyMigrations(db);

    const tables = listTables(db);

    expect(tables).toEqual(
      expect.arrayContaining([
        'schema_migrations',
        'sync_queue',
        'sync_log',
        'conflict_log',
        'sync_metadata',
        'request_cache',
        'customers',
        'items',
        'sales_invoices',
        'invoice_items',
      ])
    );
  });

  it('should migrate legacy table names', () => {
    const db = new Database(':memory:');

    db.exec(`
      CREATE TABLE offline_requests (
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
        error_message TEXT
      );

      CREATE TABLE sync_conflicts (
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    applyMigrations(db);

    const tables = listTables(db);
    expect(tables).toContain('sync_queue');
    expect(tables).toContain('conflict_log');
    expect(tables).not.toContain('offline_requests');
    expect(tables).not.toContain('sync_conflicts');
  });
});
