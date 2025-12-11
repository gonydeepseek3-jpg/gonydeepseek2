import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { logger } from './logger.js';

const MODULE = 'OfflineQueueManager';

class OfflineQueueManager {
  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'offline-queue.db');
    this.db = null;
    this.initialized = false;
    this.requestDeduplicator = new Map();
  }

  initialize() {
    try {
      this.db = new Database(this.dbPath);
      this.createTables();
      this.initialized = true;
      logger.info(MODULE, 'Offline queue database initialized', { dbPath: this.dbPath });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to initialize offline queue database', {
        error: error.message,
      });
      return false;
    }
  }

  createTables() {
    if (!this.db) return;

    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS offline_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          method TEXT NOT NULL,
          url TEXT NOT NULL,
          headers TEXT,
          body TEXT,
          request_hash TEXT UNIQUE,
          status TEXT DEFAULT 'pending',
          retry_count INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS request_cache (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          request_hash TEXT UNIQUE NOT NULL,
          response_data TEXT,
          cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_offline_requests_status ON offline_requests(status);
        CREATE INDEX IF NOT EXISTS idx_offline_requests_url ON offline_requests(url);
      `);

      logger.debug(MODULE, 'Database tables created');
    } catch (error) {
      logger.error(MODULE, 'Failed to create tables', { error: error.message });
      throw error;
    }
  }

  generateRequestHash(method, url, body) {
    const content = `${method}:${url}:${body || ''}`;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  addRequest(method, url, headers, body, requestHash) {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO offline_requests 
        (method, url, headers, body, request_hash, status) 
        VALUES (?, ?, ?, ?, ?, 'pending')
      `);

      const result = stmt.run(method, url, JSON.stringify(headers || {}), body, requestHash);

      logger.info(MODULE, 'Request added to offline queue', {
        id: result.lastInsertRowid,
        method,
        url,
      });

      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to add request to queue', { error: error.message });
      return null;
    }
  }

  getQueuedRequests(limit = 50) {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM offline_requests 
        WHERE status = 'pending' 
        ORDER BY created_at ASC 
        LIMIT ?
      `);

      const requests = stmt.all(limit);
      return requests.map((req) => ({
        ...req,
        headers: JSON.parse(req.headers || '{}'),
      }));
    } catch (error) {
      logger.error(MODULE, 'Failed to fetch queued requests', { error: error.message });
      return [];
    }
  }

  updateRequestStatus(id, status, errorMessage = null) {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        UPDATE offline_requests 
        SET status = ?, updated_at = CURRENT_TIMESTAMP, error_message = ?
        WHERE id = ?
      `);

      stmt.run(status, errorMessage, id);
      logger.debug(MODULE, 'Request status updated', { id, status });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to update request status', { error: error.message });
      return false;
    }
  }

  incrementRetryCount(id) {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        UPDATE offline_requests 
        SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(id);
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to increment retry count', { error: error.message });
      return false;
    }
  }

  removeRequest(id) {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM offline_requests WHERE id = ?');
      stmt.run(id);
      logger.debug(MODULE, 'Request removed from queue', { id });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to remove request', { error: error.message });
      return false;
    }
  }

  cacheResponse(requestHash, responseData) {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO request_cache (request_hash, response_data, cached_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(requestHash, JSON.stringify(responseData));
      logger.debug(MODULE, 'Response cached', { requestHash });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to cache response', { error: error.message });
      return false;
    }
  }

  getCachedResponse(requestHash) {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(
        'SELECT response_data FROM request_cache WHERE request_hash = ?'
      );
      const result = stmt.get(requestHash);
      return result ? JSON.parse(result.response_data) : null;
    } catch (error) {
      logger.error(MODULE, 'Failed to retrieve cached response', { error: error.message });
      return null;
    }
  }

  getQueueStats() {
    if (!this.db) {
      return {
        pending: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }

    try {
      const stmt = this.db.prepare(`
        SELECT 
          status,
          COUNT(*) as count 
        FROM offline_requests 
        GROUP BY status
      `);

      const results = stmt.all();
      const stats = {
        pending: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };

      results.forEach((row) => {
        stats[row.status] = row.count;
        stats.total += row.count;
      });

      return stats;
    } catch (error) {
      logger.error(MODULE, 'Failed to get queue statistics', { error: error.message });
      return {
        pending: 0,
        completed: 0,
        failed: 0,
        total: 0,
      };
    }
  }

  clearOldRequests(days = 7) {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        DELETE FROM offline_requests 
        WHERE created_at < datetime('now', '-' || ? || ' days')
      `);

      stmt.run(days);
      logger.info(MODULE, 'Old requests cleared from queue', { days });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to clear old requests', { error: error.message });
      return false;
    }
  }

  close() {
    if (this.db) {
      this.db.close();
      this.initialized = false;
      logger.info(MODULE, 'Database connection closed');
    }
  }
}

export const offlineQueueManager = new OfflineQueueManager();
