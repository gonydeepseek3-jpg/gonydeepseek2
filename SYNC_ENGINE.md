# Sync Engine & Conflict Resolution

## Overview

The Sync Engine provides a robust background synchronization service with exponential backoff retry logic, conflict detection and resolution, and comprehensive state management. It ensures reliable data synchronization between the offline queue and ERPNext even after extended offline periods.

## Features

### 1. Background Synchronization
- Continuous monitoring of the offline queue
- Automatic processing of pending requests when online
- Configurable batch size and processing interval
- Safe shutdown with graceful completion of in-progress syncs

### 2. Exponential Backoff Retry Logic
- Base retry delay: 1 second (configurable)
- Maximum retry delay: 5 minutes (configurable)
- Jitter added to prevent thundering herd
- Formula: `delay = min(baseDelay * 2^retryCount, maxDelay) + jitter`
- Maximum retries: 3 (configurable)

### 3. Conflict Detection & Resolution
- Automatic detection of conflicts (409/412 HTTP status codes)
- Last-write-wins (LWW) conflict resolution by default
- Custom resolution hooks for resource-specific logic
- Conflict tracking in database for manual resolution
- Support for multiple conflict types

### 4. Sync State Management
- Three states: `idle`, `syncing`, `failed`
- Real-time state broadcasting via IPC events
- Progress tracking during batch processing
- Comprehensive sync statistics

### 5. Resilience Features
- Safe shutdown waits for current sync to complete
- Tracks last sync time for recovery after extended offline periods
- Handles large queues with batch processing
- Automatic cleanup of old requests

## Architecture

### Core Components

#### SyncEngine (`src/syncEngine.js`)
Main orchestrator that manages the sync lifecycle:
- Processes queue at regular intervals
- Manages sync state transitions
- Calculates exponential backoff delays
- Emits events for state changes and progress
- Handles safe shutdown

#### ConflictResolver (`src/conflictResolver.js`)
Handles conflict detection and resolution:
- Detects conflicts from HTTP responses
- Extracts resource information from URLs and request bodies
- Applies last-write-wins strategy
- Manages custom resolution hooks
- Records conflicts in database

#### OfflineQueueManager (Enhanced)
Extended with new capabilities:
- `sync_conflicts` table for conflict tracking
- `sync_metadata` table for sync state persistence
- `next_retry_at` field for scheduling retries
- Methods for conflict management

## Configuration

Add these environment variables to your `.env` file:

```env
# Processing interval for queued requests (milliseconds)
PROCESSING_INTERVAL=5000

# Maximum number of retries for failed requests
MAX_RETRIES=3

# Base retry delay for exponential backoff (milliseconds)
BASE_RETRY_DELAY=1000

# Maximum retry delay (milliseconds)
MAX_RETRY_DELAY=300000

# Sync batch size (number of requests per batch)
SYNC_BATCH_SIZE=10
```

## Usage

### Renderer Process API

```javascript
// Get current sync status
const status = await window.offlineInterceptor.getSyncStatus();
console.log('Sync state:', status.state);
console.log('Last sync:', status.lastSyncTime);
console.log('Stats:', status.stats);

// Force immediate sync
await window.offlineInterceptor.forceSync();

// Listen for sync state changes
window.electronAPI.on('sync-state-changed', (data) => {
  console.log('Sync state:', data.state);
  console.log('Stats:', data.stats);
});

// Listen for sync progress
window.electronAPI.on('sync-progress', (data) => {
  console.log(`Progress: ${data.processed}/${data.total}`);
  console.log(`Success: ${data.successCount}, Failed: ${data.failureCount}`);
});

// Get pending conflicts
const conflicts = await window.offlineInterceptor.getPendingConflicts();
conflicts.forEach(conflict => {
  console.log('Conflict:', conflict.resource_type, conflict.resource_id);
  console.log('Local data:', conflict.local_data);
  console.log('Server data:', conflict.server_data);
});

// Resolve conflict manually
await window.offlineInterceptor.resolveConflict(conflictId, 'local_wins');
// Resolution types: 'local_wins', 'server_wins', 'manual', 'skip'
```

### Main Process API

```javascript
import { interceptorService } from './interceptorService.js';

// Register custom conflict resolution hook
interceptorService.registerConflictHook('Item', async (conflictId, conflictData) => {
  // Custom resolution logic
  console.log('Resolving conflict for:', conflictData.resourceId);
  
  // Return resolution decision
  return { resolution: 'local_wins' };
});

// Unregister hook
interceptorService.unregisterConflictHook('Item');

// Get sync status programmatically
const status = interceptorService.getSyncStatus();

// Force sync
interceptorService.forceSync();
```

## Sync States

### idle
- No sync in progress
- Waiting for next processing interval or manual trigger
- All pending requests have been processed or none exist

### syncing
- Actively processing requests from the queue
- Emitting progress events
- Retrying failed requests with exponential backoff

### failed
- Critical error occurred during sync
- Check logs for error details
- Automatically recovers on next sync attempt

## Conflict Resolution

### Automatic Detection

Conflicts are automatically detected when:
- Server returns HTTP 409 (Conflict)
- Server returns HTTP 412 (Precondition Failed)
- Error message contains "modified" keyword

### Last-Write-Wins Strategy

The default conflict resolution strategy:

1. Compare timestamps: `local_data.modified` vs `server_data.modified`
2. If local timestamp is newer → `local_wins` (request re-queued)
3. If server timestamp is newer → `server_wins` (request marked complete)
4. If timestamps equal or missing → `server_wins` (safe default)

### Custom Resolution Hooks

Register hooks for specific resource types:

```javascript
interceptorService.registerConflictHook('SalesInvoice', async (conflictId, conflictData) => {
  // Custom business logic
  const localTotal = conflictData.local_data.grand_total;
  const serverTotal = conflictData.server_data.grand_total;
  
  if (localTotal > serverTotal) {
    return { resolution: 'local_wins' };
  } else {
    return { resolution: 'server_wins' };
  }
});
```

### Manual Resolution

Users can manually resolve conflicts through the UI:

```javascript
// Get all pending conflicts
const conflicts = await window.offlineInterceptor.getPendingConflicts();

// Show conflict to user and get their decision
// Then resolve:
await window.offlineInterceptor.resolveConflict(conflictId, 'local_wins');
```

## Database Schema

### sync_conflicts Table

```sql
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (local_request_id) REFERENCES offline_requests(id)
);
```

### sync_metadata Table

```sql
CREATE TABLE sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Enhanced offline_requests Table

Added fields:
- `next_retry_at`: Timestamp for next retry attempt
- `resource_id`: Extracted resource identifier
- `resource_type`: Type of resource (e.g., 'Item', 'SalesInvoice')
- `resource_version`: Version/timestamp from server

## Exponential Backoff

The sync engine implements exponential backoff with jitter:

```
Retry 0: 1 second (base delay)
Retry 1: 2 seconds
Retry 2: 4 seconds
Retry 3: 8 seconds
Retry 4: 16 seconds
...
Max: 300 seconds (5 minutes)
```

Each retry includes random jitter (0-10% of delay) to prevent synchronized retries across multiple clients.

## Safe Shutdown

The sync engine supports graceful shutdown:

1. Stop accepting new sync cycles
2. Wait for current sync batch to complete (max 10 seconds)
3. Save sync metadata (last sync time, pending count)
4. Close database connections

```javascript
// Automatically called on app close
await interceptorService.shutdown();
```

## Recovery After Extended Offline

When the app starts after being offline for days:

1. Load last sync time from metadata
2. Calculate days since last sync
3. Process pending requests in batches
4. Handle potentially large queue gracefully
5. Apply normal retry logic with exponential backoff

## Events

### sync-state-changed

Emitted when sync state changes:

```javascript
{
  state: 'syncing',           // 'idle', 'syncing', or 'failed'
  stats: {
    successCount: 10,
    failureCount: 2,
    conflictCount: 1,
    lastSyncDuration: 5000    // milliseconds
  },
  lastSyncTime: '2024-01-15T12:00:00Z'
}
```

### sync-progress

Emitted during batch processing:

```javascript
{
  processed: 5,               // Requests processed in current batch
  total: 10,                  // Total requests in current batch
  successCount: 4,
  failureCount: 0,
  conflictCount: 1
}
```

## Best Practices

### 1. Monitor Sync State
Always display sync state to users so they know when changes are being synchronized.

### 2. Handle Conflicts Proactively
Implement custom hooks for critical resources to avoid manual resolution.

### 3. Set Appropriate Intervals
Balance sync frequency with network load:
- High frequency (5s): Real-time needs, good connectivity
- Medium frequency (30s): Normal operations
- Low frequency (60s+): Low priority, limited bandwidth

### 4. Clean Old Requests
Regularly clean old completed/failed requests:

```javascript
// Clean requests older than 7 days
await window.offlineInterceptor.clearOldRequests(7);
```

### 5. Test Offline Scenarios
Test your app after extended offline periods to ensure smooth recovery.

## Troubleshooting

### Sync Stuck in "syncing" State
- Check network connectivity
- Review logs for errors
- Force stop and restart the app
- Check for requests with very high retry counts

### Conflicts Not Being Detected
- Verify server returns proper HTTP status codes (409/412)
- Check that resource data includes `modified` timestamp
- Review conflict detection logic in logs

### Slow Sync After Long Offline
- Expected behavior with large queues
- Increase `SYNC_BATCH_SIZE` for faster processing
- Consider implementing queue prioritization

### High Retry Counts
- Check network stability
- Verify ERPNext endpoint availability
- Review error messages in failed requests
- Adjust `MAX_RETRIES` if needed

## Testing

The sync engine includes comprehensive integration tests:

- `src/__tests__/syncEngine.test.js` - Core sync functionality
- `src/__tests__/conflictResolver.test.js` - Conflict detection and resolution
- `src/__tests__/syncWorkflow.test.js` - End-to-end workflows

Run tests:

```bash
npm test
```

## Performance Considerations

### Memory Usage
- Batch processing limits memory consumption
- Old requests are cleaned automatically
- Conflicts are stored efficiently in SQLite

### CPU Usage
- Background sync runs at configurable intervals
- Processing pauses when offline
- Safe shutdown prevents resource leaks

### Network Usage
- Exponential backoff reduces unnecessary retries
- Batch processing groups requests efficiently
- Jitter prevents synchronized network spikes

## Future Enhancements

Potential improvements for future versions:

1. **Priority Queue**: Process critical requests first
2. **Conflict Preview**: Show conflicts before they occur
3. **Smart Retry**: Adjust retry strategy based on error type
4. **Compression**: Compress large request bodies
5. **Sync Scheduling**: User-defined sync windows
6. **Partial Sync**: Sync specific resource types on demand
7. **Metrics Dashboard**: Detailed sync analytics

## Related Documentation

- [Offline Interceptor](./OFFLINE_INTERCEPTOR.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [README](./README.md)
