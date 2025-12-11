import { TABLES } from '../constants.js';
import { Serializer } from '../serialization.js';

export class ConflictLogRepository {
  constructor(db) {
    this.db = db;
  }

  create(log) {
    const serialized = Serializer.serializeConflictLog(log);
    const stmt = this.db.prepare(`
      INSERT INTO ${TABLES.CONFLICT_LOGS} (
        id, conflict_type, entity_type, entity_id, local_data, remote_data,
        merged_data, resolution_status, resolution_method, resolved_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      serialized.id, serialized.conflict_type, serialized.entity_type, serialized.entity_id,
      serialized.local_data, serialized.remote_data, serialized.merged_data,
      serialized.resolution_status, serialized.resolution_method, serialized.resolved_by,
      serialized.notes
    );

    return result;
  }

  update(id, updates) {
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        if (['local_data', 'remote_data', 'merged_data'].includes(key)) {
          fields.push(`${key} = ?`);
          values.push(typeof value === 'string' ? value : JSON.stringify(value));
        } else {
          fields.push(`${key} = ?`);
          values.push(value);
        }
      }
    });

    if (fields.length === 0) return { changes: 0 };

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE ${TABLES.CONFLICT_LOGS} SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.run(...values);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.CONFLICT_LOGS} WHERE id = ?`);
    const row = stmt.get(id);
    return Serializer.deserializeConflictLog(row);
  }

  findByEntity(entityType, entityId) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CONFLICT_LOGS}
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(entityType, entityId);
    return rows.map(Serializer.deserializeConflictLog);
  }

  findPending(options = {}) {
    return this.findByResolutionStatus('pending', options);
  }

  findResolved(options = {}) {
    return this.findByResolutionStatus('resolved', options);
  }

  findRejected(options = {}) {
    return this.findByResolutionStatus('rejected', options);
  }

  findByResolutionStatus(status, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CONFLICT_LOGS}
      WHERE resolution_status = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(status, limit, offset);
    return rows.map(Serializer.deserializeConflictLog);
  }

  findByConflictType(conflictType, options = {}) {
    const { limit = 100, offset = 0 } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CONFLICT_LOGS}
      WHERE conflict_type = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(conflictType, limit, offset);
    return rows.map(Serializer.deserializeConflictLog);
  }

  findAll(options = {}) {
    const { limit = 100, offset = 0, orderBy = 'created_at DESC' } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.CONFLICT_LOGS}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset);
    return rows.map(Serializer.deserializeConflictLog);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.CONFLICT_LOGS} WHERE id = ?`);
    return stmt.run(id);
  }

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${TABLES.CONFLICT_LOGS}`;
    const params = [];

    if (filters.status) {
      sql += ' WHERE resolution_status = ?';
      params.push(filters.status);
    }

    if (filters.conflictType) {
      sql += params.length > 0 ? ' AND conflict_type = ?' : ' WHERE conflict_type = ?';
      params.push(filters.conflictType);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  resolve(id, resolvedData, method, resolvedBy = null, notes = null) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.CONFLICT_LOGS}
      SET resolution_status = ?, merged_data = ?, resolution_method = ?,
          resolved_by = ?, notes = ?, resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      'resolved',
      typeof resolvedData === 'string' ? resolvedData : JSON.stringify(resolvedData),
      method,
      resolvedBy,
      notes,
      id
    );
  }

  reject(id, notes = null) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.CONFLICT_LOGS}
      SET resolution_status = ?, notes = ?, resolved_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run('rejected', notes, id);
  }

  logConflict(conflictType, entityType, entityId, localData, remoteData, notes = null) {
    const id = `conflict_${entityType}_${entityId}_${Date.now()}`;
    return this.create({
      id,
      conflict_type: conflictType,
      entity_type: entityType,
      entity_id: entityId,
      local_data: localData,
      remote_data: remoteData,
      notes,
    });
  }

  getUnresolvedConflicts(entityType = null) {
    let sql = `SELECT * FROM ${TABLES.CONFLICT_LOGS} WHERE resolution_status = 'pending'`;
    const params = [];

    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }

    sql += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);
    return rows.map(Serializer.deserializeConflictLog);
  }

  cleanupResolved(olderThanDays = 30) {
    const date = new Date();
    date.setDate(date.getDate() - olderThanDays);
    const isoDate = date.toISOString();

    const stmt = this.db.prepare(`
      DELETE FROM ${TABLES.CONFLICT_LOGS}
      WHERE resolution_status IN ('resolved', 'rejected')
      AND resolved_at < ?
    `);
    return stmt.run(isoDate);
  }
}
