// Database module exports
export { posDatabase } from './db.js';
export { databaseMigrations } from './migrations.js';

// Initialize database on module load
import { databaseMigrations } from './migrations.js';

let initialized = false;

export async function initializeDatabase() {
  if (!initialized) {
    await databaseMigrations.initialize();
    initialized = true;
  }
  return initialized;
}

// Auto-initialize when imported in main process
if (typeof window === 'undefined') {
  // Server-side initialization
  initializeDatabase().catch((error) => {
    console.error('Failed to auto-initialize database:', error);
  });
}
