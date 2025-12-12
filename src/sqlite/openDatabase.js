import Database from 'better-sqlite3';
import { applyMigrations } from './migrations.js';

export function openDatabase(dbPath = ':memory:', { logger } = {}) {
  const db = new Database(dbPath);
  applyMigrations(db, logger);
  return db;
}
