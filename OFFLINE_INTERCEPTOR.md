# Offline Interceptor Service Documentation

## Overview

The offline interceptor service provides an HTTP proxy/interceptor layer that sits between the POSAwesome frontend and the ERPNext REST API. It enables seamless offline operation by:

- Intercepting all fetch/XHR calls through the preload script
- Routing requests through a Node.js service that decides between online pass-through and offline queuing
- Supporting token-based authentication with secure credential storage
- Implementing request deduplication
- Persisting offline requests into SQLite
- Exposing IPC APIs for the renderer to monitor queue status

## Architecture

### Core Components

1. **HTTPInterceptor** (`src/httpInterceptor.js`)
   - Handles individual request execution
   - Manages online/offline status
   - Implements authentication header injection
   - Caches successful responses
   - Queues failed requests for later processing

2. **OfflineQueueManager** (`src/offlineQueueManager.js`)
   - Manages SQLite database for persistent request storage
   - Tracks request status (pending, completed, failed)
   - Handles request deduplication via request hashing
   - Caches responses for GET requests
   - Provides queue statistics

3. **RequestProcessor** (`src/requestProcessor.js`)
   - Periodically processes queued requests when online
   - Implements retry logic with configurable max retries
   - Manages request lifecycle

4. **CredentialStore** (`src/credentialStore.js`)
   - Securely stores API credentials
   - Encrypts/decrypts credentials using AES encryption
   - Provides credentials to all outgoing requests

5. **Logger** (`src/logger.js`)
   - Logs all activity to `userData/logs/app.log`
   - Supports different log levels (INFO, WARN, ERROR, DEBUG)
   - Controlled by `DEBUG` environment variable

6. **InterceptorService** (`src/interceptorService.js`)
   - Main service orchestrating all components
   - Initializes and shuts down the service
   - Provides unified API for all operations

## Configuration

Add the following environment variables to your `.env` file:

```
# Offline Interceptor Configuration
# Processing interval for queued requests (milliseconds)
PROCESSING_INTERVAL=5000

# Maximum number of retries for failed requests
MAX_RETRIES=3

# Request timeout (milliseconds)
REQUEST_TIMEOUT=30000

# Enable debug logging
DEBUG=false
```

## Usage

### Renderer Process (Frontend)

The offline interceptor API is exposed through the `window.offlineInterceptor` object:

#### Setting Credentials

```javascript
// Store API credentials securely
const result = await window.offlineInterceptor.setCredentials(
  'your-api-token',
  'your-api-secret'
);

if (result.success) {
  console.log('Credentials stored');
}
```

#### Managing Online/Offline Status

```javascript
// Set online status (e.g., when detecting connection change)
await window.offlineInterceptor.setOnlineStatus(true);

// When connection is lost
await window.offlineInterceptor.setOnlineStatus(false);
```

#### Monitoring Queue Status

```javascript
// Get overall queue statistics
const stats = await window.offlineInterceptor.getQueueStatus();
console.log(`Pending: ${stats.pending}, Completed: ${stats.completed}`);

// Get detailed queued requests
const requests = await window.offlineInterceptor.getQueuedRequests(10);
requests.forEach(req => {
  console.log(`${req.method} ${req.url} - ${req.status}`);
});
```

#### Managing Queue

```javascript
// Remove a specific request from queue
const result = await window.offlineInterceptor.removeRequest(requestId);

// Clear requests older than 7 days
const result = await window.offlineInterceptor.clearOldRequests(7);
```

### Main Process (Backend)

The interceptor service is automatically initialized when the application starts:

```javascript
import { interceptorService } from './src/interceptorService.js';

// Service is already initialized by main.js
// Access it directly for backend operations

// Check queue status
const stats = interceptorService.getQueueStatus();

// Set credentials programmatically
interceptorService.setCredentials(token, secret);

// Force process queue
await requestProcessor.processQueue();
```

## Request Flow

### Online Mode

1. User initiates a request in POSAwesome
2. Request is intercepted by preload script
3. Credentials are injected via HTTPInterceptor
4. Request is executed directly to ERPNext API
5. Response is cached for potential offline use
6. Response returned to user

### Offline Mode (GET Request)

1. User initiates a GET request
2. Request is intercepted
3. Cached response is returned if available
4. If no cache, 503 Service Unavailable is returned

### Offline Mode (POST/PUT/DELETE Request)

1. User initiates a write request
2. Request is intercepted
3. Request is added to SQLite queue with deduplication
4. 202 Accepted response with queue ID returned immediately
5. When online, SyncEngine processes queued requests
6. Retries continue until success or max retries exceeded

## Database Schema

### sync_queue Table

```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  method TEXT NOT NULL,              -- HTTP method (GET, POST, etc.)
  url TEXT NOT NULL,                 -- Request URL
  headers TEXT,                      -- JSON-encoded headers
  body TEXT,                         -- Request body
  request_hash TEXT UNIQUE,          -- Hash for deduplication
  status TEXT DEFAULT 'pending',     -- pending, completed, failed
  retry_count INTEGER DEFAULT 0,     -- Number of retry attempts
  next_retry_at DATETIME,            -- Next allowed retry time (backoff)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,                -- Error details if failed
  resource_id TEXT,
  resource_type TEXT,
  resource_version TEXT
);
```

### request_cache Table

```sql
CREATE TABLE request_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_hash TEXT UNIQUE NOT NULL,
  response_data TEXT,                -- JSON-encoded response
  cached_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Logging

All activity is logged to `userData/logs/app.log` with the following format:

```
[2024-01-15T10:30:45.123Z] [INFO] [HTTPInterceptor] Online request successful {method: "GET", url: "/api/resource"}
```

Enable debug logging by setting `DEBUG=true` in your environment:

```
DEBUG=true
```

## Error Handling

### Request Failures

- Network errors: Request added to queue, will retry when online
- HTTP errors (4xx): Request fails, user receives error response
- Timeout errors: Request added to queue for retry
- Max retries exceeded: Request marked as failed, error logged

### Queue Processing

- Failed to add to queue: User receives 500 error
- Database errors: Logged and skipped, service continues
- Processing errors: Request retried up to max retries

## Testing

The project includes comprehensive unit tests for all components:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Test Coverage

- **Logger**: File writing, message formatting
- **CredentialStore**: Encryption, storage, retrieval
- **OfflineQueueManager**: Database operations, caching
- **HTTPInterceptor**: Online/offline handling, authentication
- **InterceptorService**: Initialization, credential management, queue operations

## Performance Considerations

1. **Request Hashing**: Uses SHA256 for deduplication - minimal overhead
2. **Database**: SQLite is used for local persistence - efficient for small to medium datasets
3. **Processing Interval**: Default 5 seconds, configurable via `PROCESSING_INTERVAL`
4. **Memory**: Request deduplicator uses in-memory Map - cleared periodically
5. **Concurrency**: Queue processing is serialized to avoid race conditions

## Security Considerations

1. **Credential Storage**: Uses AES encryption with machine-derived key
2. **IPC Isolation**: Preload script validates all IPC channels
3. **Request Headers**: Authentication headers added only to allowed requests
4. **Database Access**: File-based SQLite stored in user data directory
5. **Logging**: Credentials never logged, only request metadata

## Future Enhancements

- [ ] Implement request compression for offline storage
- [ ] Add support for request prioritization
- [ ] Implement conflict resolution for concurrent updates
- [ ] Add support for request scheduling
- [ ] Implement request analytics dashboard
- [ ] Add support for selective sync (offline/online per resource)

## Troubleshooting

### Queue not processing

1. Check if service is online: `interceptorService.httpInterceptor.isOnline`
2. Verify requests are in queue: `interceptorService.getQueueStatus()`
3. Check logs: `tail -f userData/logs/app.log`
4. Verify network connectivity

### High memory usage

1. Clear old requests: `interceptorService.clearOldRequests(3)`
2. Reduce processing interval: `PROCESSING_INTERVAL=10000`
3. Clear completed requests from database

### Credentials not persisting

1. Verify credentials are set: `interceptorService.getCredentials()`
2. Check file permissions on userData directory
3. Verify encryption key derivation is consistent
4. Check logs for encryption errors

## API Reference

### offlineInterceptor (Renderer API)

```javascript
// Credentials
setCredentials(token, secret): Promise<{success: boolean, error?: string}>
getCredentials(): Promise<{token: string | null, secret: string | null}>
clearCredentials(): Promise<{success: boolean, error?: string}>

// Queue Management
getQueueStatus(): Promise<{pending: number, completed: number, failed: number, total: number}>
getQueuedRequests(limit?: number): Promise<Request[]>
removeRequest(id: number): Promise<{success: boolean, error?: string}>

// Status
setOnlineStatus(isOnline: boolean): Promise<{success: boolean, error?: string}>

// Maintenance
clearOldRequests(days?: number): Promise<{success: boolean, error?: string}>
```

### InterceptorService (Backend API)

```javascript
initialize(): boolean
shutdown(): void
setOnlineStatus(isOnline: boolean): void
setCredentials(token: string, secret: string): boolean
getCredentials(): {token: string, secret: string} | null
clearCredentials(): boolean
getQueueStatus(): {pending: number, completed: number, failed: number, total: number}
getQueuedRequests(limit?: number): Request[]
removeRequest(id: number): boolean
clearOldRequests(days?: number): boolean
```
