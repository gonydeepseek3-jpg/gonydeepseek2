import { TABLES } from '../constants.js';

export class SyncMetadataRepository {
  constructor(db) {
    this.db = db;
  }

  create(metadata) {
    const stmt = this.db.prepare(`
      INSERT INTO ${TABLES.SYNC_METADATA} (
        id, entity_type, last_sync_time, sync_token, last_sync_count,
        total_synced_count, is_initial_sync_done, next_sync_time, sync_interval_seconds
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      metadata.id,
      metadata.entity_type,
      metadata.last_sync_time || null,
      metadata.sync_token || null,
      metadata.last_sync_count || 0,
      metadata.total_synced_count || 0,
      metadata.is_initial_sync_done ? 1 : 0,
      metadata.next_sync_time || null,
      metadata.sync_interval_seconds || 3600
    );

    return result;
  }

  update(id, updates) {
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        if (key === 'is_initial_sync_done') {
          fields.push(`${key} = ?`);
          values.push(value ? 1 : 0);
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return { changes: 0 };

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE ${TABLES.SYNC_METADATA} SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.run(...values);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.SYNC_METADATA} WHERE id = ?`);
    const row = stmt.get(id);
    return this.deserialize(row);
  }

  findByEntityType(entityType) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.SYNC_METADATA} WHERE entity_type = ?`);
    const row = stmt.get(entityType);
    return this.deserialize(row);
  }

  findAll() {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.SYNC_METADATA}`);
    const rows = stmt.all();
    return rows.map(r => this.deserialize(r));
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.SYNC_METADATA} WHERE id = ?`);
    return stmt.run(id);
  }

  updateLastSyncTime(entityType, time, count = 0) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.SYNC_METADATA}
      SET last_sync_time = ?, last_sync_count = ?, total_synced_count = total_synced_count + ?,
          is_initial_sync_done = 1, next_sync_time = datetime('now', '+' || sync_interval_seconds || ' seconds'),
          updated_at = CURRENT_TIMESTAMP
      WHERE entity_type = ?
    `);
    return stmt.run(time || new Date().toISOString(), count, count, entityType);
  }

  updateSyncToken(entityType, token) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.SYNC_METADATA}
      SET sync_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE entity_type = ?
    `);
    return stmt.run(token, entityType);
  }

  markInitialSyncDone(entityType) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.SYNC_METADATA}
      SET is_initial_sync_done = 1, updated_at = CURRENT_TIMESTAMP
      WHERE entity_type = ?
    `);
    return stmt.run(entityType);
  }

  getNextSyncDue(entityType) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.SYNC_METADATA}
      WHERE entity_type = ? AND (next_sync_time IS NULL OR next_sync_time <= datetime('now'))
    `);
    const row = stmt.get(entityType);
    return this.deserialize(row);
  }

  getAllDue() {
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.SYNC_METADATA}
      WHERE next_sync_time IS NULL OR next_sync_time <= datetime('now')
    `);
    const rows = stmt.all();
    return rows.map(r => this.deserialize(r));
  }

  deserialize(row) {
    if (!row) return null;
    return {
      id: row.id,
      entity_type: row.entity_type,
      last_sync_time: row.last_sync_time,
      sync_token: row.sync_token,
      last_sync_count: row.last_sync_count,
      total_synced_count: row.total_synced_count,
      is_initial_sync_done: row.is_initial_sync_done === 1,
      next_sync_time: row.next_sync_time,
      sync_interval_seconds: row.sync_interval_seconds,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  initializeMetadata(entityType, syncIntervalSeconds = 3600) {
    const id = `sync_${entityType}`;
    const existing = this.findByEntityType(entityType);

    if (!existing) {
      return this.create({
        id,
        entity_type: entityType,
        sync_interval_seconds: syncIntervalSeconds,
      });
    }

    return { changes: 0 };
  }
}
