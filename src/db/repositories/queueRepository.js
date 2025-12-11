import { TABLES, QUEUE_STATUS } from '../constants.js';
import { Serializer } from '../serialization.js';

export class QueueRepository {
  constructor(db) {
    this.db = db;
  }

  create(request) {
    const serialized = Serializer.serializeQueuedRequest(request);
    const stmt = this.db.prepare(`
      INSERT INTO ${TABLES.QUEUED_REQUESTS} (
        id, request_type, entity_type, entity_id, operation, payload, status,
        priority, retry_count, max_retries, error_message, response_data
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      serialized.id, serialized.request_type, serialized.entity_type, serialized.entity_id,
      serialized.operation, serialized.payload, serialized.status, serialized.priority,
      serialized.retry_count, serialized.max_retries, serialized.error_message,
      serialized.response_data
    );

    return result;
  }

  update(id, updates) {
    const fields = [];
    const values = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    });

    if (fields.length === 0) return { changes: 0 };

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE ${TABLES.QUEUED_REQUESTS} SET ${fields.join(', ')} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    return stmt.run(...values);
  }

  findById(id) {
    const stmt = this.db.prepare(`SELECT * FROM ${TABLES.QUEUED_REQUESTS} WHERE id = ?`);
    const row = stmt.get(id);
    return Serializer.deserializeQueuedRequest(row);
  }

  findByStatus(status, options = {}) {
    const { limit = 100, offset = 0, priority = false } = options;
    let sql = `
      SELECT * FROM ${TABLES.QUEUED_REQUESTS}
      WHERE status = ?
      ORDER BY ${priority ? 'priority DESC, ' : ''}created_at ASC
      LIMIT ? OFFSET ?
    `;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(status, limit, offset);
    return rows.map(Serializer.deserializeQueuedRequest);
  }

  findPending(options = {}) {
    return this.findByStatus(QUEUE_STATUS.PENDING, options);
  }

  findFailed(options = {}) {
    return this.findByStatus(QUEUE_STATUS.FAILED, options);
  }

  findProcessing(options = {}) {
    return this.findByStatus(QUEUE_STATUS.PROCESSING, options);
  }

  findByEntity(entityType, entityId) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.QUEUED_REQUESTS}
      WHERE entity_type = ? AND entity_id = ?
      ORDER BY created_at DESC
    `);
    const rows = stmt.all(entityType, entityId);
    return rows.map(Serializer.deserializeQueuedRequest);
  }

  findAll(options = {}) {
    const { limit = 100, offset = 0, orderBy = 'created_at DESC' } = options;
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.QUEUED_REQUESTS}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `);
    const rows = stmt.all(limit, offset);
    return rows.map(Serializer.deserializeQueuedRequest);
  }

  delete(id) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.QUEUED_REQUESTS} WHERE id = ?`);
    return stmt.run(id);
  }

  deleteByStatus(status) {
    const stmt = this.db.prepare(`DELETE FROM ${TABLES.QUEUED_REQUESTS} WHERE status = ?`);
    return stmt.run(status);
  }

  count(filters = {}) {
    let sql = `SELECT COUNT(*) as count FROM ${TABLES.QUEUED_REQUESTS}`;
    const params = [];

    if (filters.status) {
      sql += ' WHERE status = ?';
      params.push(filters.status);
    }

    if (filters.entityType && params.length > 0) {
      sql += ' AND entity_type = ?';
      params.push(filters.entityType);
    } else if (filters.entityType) {
      sql += ' WHERE entity_type = ?';
      params.push(filters.entityType);
    }

    const stmt = this.db.prepare(sql);
    const result = stmt.get(...params);
    return result.count;
  }

  updateStatus(id, status, responseData = null, errorMessage = null) {
    const processedAt = status === QUEUE_STATUS.COMPLETED ? new Date().toISOString() : null;
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.QUEUED_REQUESTS}
      SET status = ?, response_data = ?, error_message = ?, processed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(
      status,
      responseData ? (typeof responseData === 'string' ? responseData : JSON.stringify(responseData)) : null,
      errorMessage,
      processedAt,
      id
    );
  }

  incrementRetryCount(id) {
    const stmt = this.db.prepare(`
      UPDATE ${TABLES.QUEUED_REQUESTS}
      SET retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  markAsProcessing(id) {
    return this.updateStatus(id, QUEUE_STATUS.PROCESSING);
  }

  markAsCompleted(id, responseData) {
    return this.updateStatus(id, QUEUE_STATUS.COMPLETED, responseData);
  }

  markAsFailed(id, errorMessage) {
    return this.updateStatus(id, QUEUE_STATUS.FAILED, null, errorMessage);
  }

  clearCompleted() {
    const stmt = this.db.prepare(`
      DELETE FROM ${TABLES.QUEUED_REQUESTS}
      WHERE status = ?
    `);
    return stmt.run(QUEUE_STATUS.COMPLETED);
  }

  getRetryableFailed(maxRetries = 3) {
    const stmt = this.db.prepare(`
      SELECT * FROM ${TABLES.QUEUED_REQUESTS}
      WHERE status = ? AND retry_count < ?
      ORDER BY priority DESC, created_at ASC
      LIMIT 100
    `);
    const rows = stmt.all(QUEUE_STATUS.FAILED, maxRetries);
    return rows.map(Serializer.deserializeQueuedRequest);
  }

  bulkCreate(requests) {
    const transaction = this.db.transaction(() => {
      const results = [];
      for (const request of requests) {
        const result = this.create(request);
        results.push(result);
      }
      return results;
    });
    return transaction();
  }
}
