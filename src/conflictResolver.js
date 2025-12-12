import { offlineQueueManager } from './offlineQueueManager.js';
import { logger } from './logger.js';

const MODULE = 'ConflictResolver';

class ConflictResolver {
  constructor() {
    this.resolutionHooks = new Map();
  }

  registerResolutionHook(resourceType, hookFn) {
    if (typeof hookFn !== 'function') {
      throw new Error('Resolution hook must be a function');
    }
    this.resolutionHooks.set(resourceType, hookFn);
    logger.info(MODULE, 'Resolution hook registered', { resourceType });
  }

  unregisterResolutionHook(resourceType) {
    this.resolutionHooks.delete(resourceType);
    logger.info(MODULE, 'Resolution hook unregistered', { resourceType });
  }

  extractResourceInfo(url, body) {
    const urlParts = url.split('/').filter(Boolean);
    const resourceType = urlParts[urlParts.length - 2] || 'unknown';
    const resourceId = urlParts[urlParts.length - 1] || null;

    let parsedBody = {};
    if (body) {
      try {
        parsedBody = typeof body === 'string' ? JSON.parse(body) : body;
      } catch {
        parsedBody = {};
      }
    }

    return {
      resourceType,
      resourceId: resourceId || parsedBody.name || parsedBody.id,
      data: parsedBody,
    };
  }

  detectConflict(request, serverResponse) {
    if (!serverResponse || serverResponse.status === 200 || serverResponse.status === 201) {
      return null;
    }

    if (serverResponse.status === 409 || serverResponse.status === 412) {
      logger.info(MODULE, 'Conflict detected from server response', {
        requestId: request.id,
        status: serverResponse.status,
      });

      const { resourceType, resourceId, data } = this.extractResourceInfo(
        request.url,
        request.body
      );

      return {
        type: 'version_mismatch',
        resourceId,
        resourceType,
        localData: data,
        serverData: serverResponse.data || {},
        serverVersion: serverResponse.data?.modified || serverResponse.data?._version || null,
      };
    }

    if (serverResponse.status === 400 && serverResponse.data?.message?.includes('modified')) {
      logger.info(MODULE, 'Potential conflict detected from error message', {
        requestId: request.id,
      });

      const { resourceType, resourceId, data } = this.extractResourceInfo(
        request.url,
        request.body
      );

      return {
        type: 'modified_conflict',
        resourceId,
        resourceType,
        localData: data,
        serverData: serverResponse.data || {},
        serverVersion: null,
      };
    }

    return null;
  }

  async applyLastWriteWins(conflictId) {
    const conflict = offlineQueueManager.getConflictById(conflictId);
    if (!conflict) {
      logger.error(MODULE, 'Conflict not found', { conflictId });
      return false;
    }

    logger.info(MODULE, 'Applying last-write-wins strategy', {
      conflictId,
      resourceId: conflict.resource_id,
    });

    const localTimestamp = conflict.local_data?.modified || conflict.local_data?.updated_at;
    const serverTimestamp = conflict.server_data?.modified || conflict.server_data?.updated_at;

    let resolution;
    if (localTimestamp && serverTimestamp) {
      const localDate = new Date(localTimestamp);
      const serverDate = new Date(serverTimestamp);

      resolution = localDate > serverDate ? 'local_wins' : 'server_wins';
    } else {
      resolution = 'server_wins';
    }

    logger.info(MODULE, 'Last-write-wins resolution determined', {
      conflictId,
      resolution,
      localTimestamp,
      serverTimestamp,
    });

    offlineQueueManager.resolveConflict(conflictId, resolution);

    if (resolution === 'local_wins' && conflict.local_request_id) {
      offlineQueueManager.updateRequestStatus(conflict.local_request_id, 'pending');
      logger.info(MODULE, 'Request re-queued for retry (local wins)', {
        requestId: conflict.local_request_id,
      });
    } else if (resolution === 'server_wins' && conflict.local_request_id) {
      offlineQueueManager.updateRequestStatus(
        conflict.local_request_id,
        'completed',
        'Resolved: server wins'
      );
      logger.info(MODULE, 'Request marked as completed (server wins)', {
        requestId: conflict.local_request_id,
      });
    }

    return true;
  }

  async handleConflict(request, serverResponse) {
    const conflictData = this.detectConflict(request, serverResponse);

    if (!conflictData) {
      return null;
    }

    const conflictId = offlineQueueManager.addConflict(
      conflictData.resourceId,
      conflictData.resourceType,
      request.id,
      conflictData.localData,
      conflictData.serverData,
      conflictData.serverVersion,
      conflictData.type
    );

    if (!conflictId) {
      logger.error(MODULE, 'Failed to record conflict', { requestId: request.id });
      return null;
    }

    const hook = this.resolutionHooks.get(conflictData.resourceType);
    if (hook) {
      try {
        logger.info(MODULE, 'Invoking custom resolution hook', {
          conflictId,
          resourceType: conflictData.resourceType,
        });

        const hookResult = await hook(conflictId, conflictData);
        if (hookResult && hookResult.resolution) {
          offlineQueueManager.resolveConflict(conflictId, hookResult.resolution);
          return { conflictId, resolved: true, resolution: hookResult.resolution };
        }
      } catch (error) {
        logger.error(MODULE, 'Custom resolution hook failed', {
          conflictId,
          error: error.message,
        });
      }
    }

    await this.applyLastWriteWins(conflictId);

    return { conflictId, resolved: true, resolution: 'last_write_wins' };
  }

  getPendingConflicts(limit = 50) {
    return offlineQueueManager.getPendingConflicts(limit);
  }

  resolveConflictManually(conflictId, resolution) {
    if (!['local_wins', 'server_wins', 'manual', 'skip'].includes(resolution)) {
      throw new Error('Invalid resolution type');
    }

    const conflict = offlineQueueManager.getConflictById(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    logger.info(MODULE, 'Manual conflict resolution', { conflictId, resolution });

    offlineQueueManager.resolveConflict(conflictId, resolution);

    if (resolution === 'local_wins' && conflict.local_request_id) {
      offlineQueueManager.updateRequestStatus(conflict.local_request_id, 'pending');
    } else if (['server_wins', 'skip'].includes(resolution) && conflict.local_request_id) {
      offlineQueueManager.updateRequestStatus(
        conflict.local_request_id,
        'completed',
        `Resolved: ${resolution}`
      );
    }

    return true;
  }
}

export const conflictResolver = new ConflictResolver();
