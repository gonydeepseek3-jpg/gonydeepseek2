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

        CREATE TABLE IF NOT EXISTS sync_conflicts (
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
          FOREIGN KEY (local_request_id) REFERENCES offline_requests(id)
        );

        CREATE TABLE IF NOT EXISTS sync_metadata (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_offline_requests_status ON offline_requests(status);
        CREATE INDEX IF NOT EXISTS idx_offline_requests_url ON offline_requests(url);
        CREATE INDEX IF NOT EXISTS idx_offline_requests_next_retry ON offline_requests(next_retry_at);
        CREATE INDEX IF NOT EXISTS idx_sync_conflicts_resource ON sync_conflicts(resource_id, resource_type);
        CREATE INDEX IF NOT EXISTS idx_sync_conflicts_status ON sync_conflicts(resolution_status);
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

  getRequestsReadyForRetry() {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM offline_requests 
        WHERE status = 'pending' 
        AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
        ORDER BY created_at ASC 
        LIMIT 50
      `);

      const requests = stmt.all();
      return requests.map((req) => ({
        ...req,
        headers: JSON.parse(req.headers || '{}'),
      }));
    } catch (error) {
      logger.error(MODULE, 'Failed to fetch requests ready for retry', { error: error.message });
      return [];
    }
  }

  setNextRetryTime(id, retryDelayMs) {
    if (!this.db) return false;

    try {
      const nextRetry = new Date(Date.now() + retryDelayMs).toISOString();
      const stmt = this.db.prepare(`
        UPDATE offline_requests 
        SET next_retry_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(nextRetry, id);
      logger.debug(MODULE, 'Next retry time set', { id, nextRetry });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to set next retry time', { error: error.message });
      return false;
    }
  }

  addConflict(resourceId, resourceType, localRequestId, localData, serverData, serverVersion, conflictType) {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO sync_conflicts 
        (resource_id, resource_type, local_request_id, local_data, server_data, server_version, conflict_type, resolution_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `);

      const result = stmt.run(
        resourceId,
        resourceType,
        localRequestId,
        JSON.stringify(localData),
        JSON.stringify(serverData),
        serverVersion,
        conflictType
      );

      logger.info(MODULE, 'Conflict recorded', {
        id: result.lastInsertRowid,
        resourceId,
        conflictType,
      });

      return result.lastInsertRowid;
    } catch (error) {
      logger.error(MODULE, 'Failed to add conflict', { error: error.message });
      return null;
    }
  }

  getPendingConflicts(limit = 50) {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM sync_conflicts 
        WHERE resolution_status = 'pending'
        ORDER BY created_at ASC
        LIMIT ?
      `);

      const conflicts = stmt.all(limit);
      return conflicts.map((conflict) => ({
        ...conflict,
        local_data: JSON.parse(conflict.local_data || '{}'),
        server_data: JSON.parse(conflict.server_data || '{}'),
      }));
    } catch (error) {
      logger.error(MODULE, 'Failed to fetch pending conflicts', { error: error.message });
      return [];
    }
  }

  resolveConflict(conflictId, resolution) {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        UPDATE sync_conflicts 
        SET resolution_status = ?, resolved_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(resolution, conflictId);
      logger.info(MODULE, 'Conflict resolved', { conflictId, resolution });
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to resolve conflict', { error: error.message });
      return false;
    }
  }

  getConflictById(conflictId) {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM sync_conflicts WHERE id = ?');
      const conflict = stmt.get(conflictId);
      
      if (!conflict) return null;

      return {
        ...conflict,
        local_data: JSON.parse(conflict.local_data || '{}'),
        server_data: JSON.parse(conflict.server_data || '{}'),
      };
    } catch (error) {
      logger.error(MODULE, 'Failed to get conflict', { error: error.message });
      return null;
    }
  }

  setSyncMetadata(key, value) {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(MODULE, 'Failed to set sync metadata', { error: error.message });
      return false;
    }
  }

  getSyncMetadata(key) {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?');
      const result = stmt.get(key);
      
      if (!result) return null;

      try {
        return JSON.parse(result.value);
      } catch {
        return result.value;
      }
    } catch (error) {
      logger.error(MODULE, 'Failed to get sync metadata', { error: error.message });
      return null;
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
