# HTTP Interceptor Service

This directory contains the core components of the offline HTTP interceptor service.

## File Structure

- `../logger.js` - Logging module for all services
- `../credentialStore.js` - Secure credential storage and encryption
- `../offlineQueueManager.js` - SQLite-based offline request queue management
- `../httpInterceptor.js` - Core HTTP request interception and routing
- `../requestProcessor.js` - Periodic queue processing when online
- `../interceptorService.js` - Main service orchestrating all components

## Key Features

### Offline Support
- Automatically detects online/offline status
- Queues write requests (POST, PUT, DELETE) when offline
- Returns cached responses for read requests (GET, HEAD, OPTIONS)
- Automatically processes queue when connection is restored

### Secure Authentication
- Stores API credentials securely with AES encryption
- Automatically injects authentication headers into all requests
- Supports token-based authentication (API token + secret)

### Request Deduplication
- Uses SHA256 hashing to deduplicate requests
- Prevents duplicate requests from being queued
- Improves efficiency and reduces storage usage

### Persistence
- SQLite database for local request storage
- Tracks request status and retry counts
- Caches successful responses for offline use
- Automatic cleanup of old requests

### Monitoring & Control
- IPC APIs to monitor queue status
- Real-time statistics on pending/completed/failed requests
- Manual queue management (remove, clear old requests)
- Online/offline status control

## Service Initialization

The interceptor service is automatically initialized when the application starts:

```javascript
// In src/main.js
app.on('ready', () => {
  interceptorService.initialize();
  createWindow();
});
```

## IPC API Endpoints

### Credentials
- `interceptor-set-credentials` - Store API credentials
- `interceptor-get-credentials` - Retrieve current credentials
- `interceptor-clear-credentials` - Clear stored credentials

### Queue Management
- `interceptor-get-queue-status` - Get queue statistics
- `interceptor-get-queued-requests` - Get list of queued requests
- `interceptor-remove-request` - Remove a specific request

### Status Control
- `interceptor-set-online-status` - Update online/offline status

### Maintenance
- `interceptor-clear-old-requests` - Remove old requests from queue

## Database Location

The SQLite database is stored at:
```
{userData}/offline-queue.db
```

Where `{userData}` is the application user data directory.

## Logs Location

Logs are written to:
```
{userData}/logs/app.log
```

## Performance Characteristics

- **Memory**: Minimal, deduplicator uses in-memory Map
- **Disk**: SQLite database grows with number of pending requests
- **CPU**: Periodic background processing every 5 seconds (configurable)
- **Network**: Only processes when online, uses exponential backoff

## Error Handling

- Network errors: Automatic retry with configurable max retries
- Authentication errors: Logged and request marked as failed
- Database errors: Logged, queue processing continues
- Timeout errors: Request retried, automatic fallback to offline

## Security Measures

1. **Preload Script Isolation**: IPC channels validated against whitelist
2. **Credential Encryption**: AES encryption with machine-derived key
3. **No Credential Logging**: Credentials never written to logs
4. **Secure Headers**: Auth headers only added to allowed requests
5. **File Permissions**: Database stored in user-protected directory
