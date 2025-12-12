# POSAwesome Desktop Application

A modern Electron-based desktop application for running ERPNext POSAwesome (Point of Sale) locally with comprehensive offline support, sync management, and built-in admin dashboard.

## Overview

POSAwesome Desktop provides a native desktop experience for ERPNext POS operations, enabling:

- **Local execution** of the ERPNext POSAwesome interface via Electron
- **Secure IPC communication** between main and renderer processes
- **Environment-based configuration** for ERPNext connectivity
- **Comprehensive offline mode support** with automatic request queuing and synchronization
- **Automatic synchronization** with ERPNext backend with conflict resolution
- **Built-in Admin Dashboard** for real-time monitoring and manual intervention
- **Secure credential storage** with AES encryption
- **SQLite-based offline request persistence** for seamless online/offline transitions
- **Lightweight vanilla JavaScript admin panel** with keyboard shortcuts and menu access

### 🆕 Admin Dashboard Features

The built-in admin dashboard provides comprehensive monitoring and control:

- **Sync Status Monitoring**: Real-time sync state, statistics, and last sync times
- **Queue Management**: View and manage queued requests with retry capabilities
- **Conflict Resolution**: Manual resolution interface for data conflicts
- **Credential Management**: Secure API token/secret storage interface
- **Maintenance Tools**: Clear old requests, force sync, toggle online status
- **Keyboard Shortcuts**: Press `Ctrl+Shift+A` to toggle the dashboard
- **Menu Integration**: Access via View → Admin Dashboard in the application menu

## System Requirements

- **Node.js**: 16.0.0 or higher
- **npm**: 7.0.0 or higher (or yarn/pnpm)
- **Windows**: Windows 7 or later for the packaged application
- **ERPNext Instance**: A running ERPNext instance (local or remote) accessible via HTTP(S)

## Project Structure

```
posawsome-desktop/
├── src/
│   ├── main.js                          # Electron main process
│   ├── preload.js                       # Secure IPC preload script
│   ├── logger.js                        # Logging service
│   ├── credentialStore.js               # Secure credential storage
│   ├── offlineQueueManager.js           # SQLite offline queue
│   ├── httpInterceptor.js               # HTTP request interception
│   ├── syncEngine.js                    # Background sync service
│   ├── conflictResolver.js              # Conflict detection & resolution
│   ├── interceptorService.js            # Offline service orchestrator
│   ├── renderer/
│   │   ├── index.html                   # Main renderer HTML
│   │   ├── styles/
│   │   │   └── main.css                 # Application styling + admin dashboard
│   │   └── js/
│   │       ├── app.js                   # Renderer process JavaScript
│   │       ├── admin.js                 # Admin dashboard module
│   │       └── offline-interceptor-example.js # Usage example
│   └── __tests__/                       # Unit and integration tests
│       ├── logger.test.js
│       ├── credentialStore.test.js
│       ├── offlineQueueManager.test.js
│       ├── httpInterceptor.test.js
│       ├── interceptorService.test.js
│       ├── syncEngine.test.js
│       ├── conflictResolver.test.js
│       └── syncWorkflow.test.js
│
├── package.json                         # Project dependencies and scripts
├── vitest.config.js                     # Vitest configuration
├── .env.sample                          # Sample environment configuration
├── .env                                 # Environment configuration (gitignored)
├── .eslintrc.json                       # ESLint configuration
├── .prettierrc                          # Prettier code formatting config
├── .gitignore                           # Git ignore rules
├── OFFLINE_INTERCEPTOR.md               # Offline interceptor documentation
├── SYNC_ENGINE.md                       # Sync engine & conflict resolution docs
└── README.md                            # This file
```

## Getting Started

### 1. Installation

Clone the repository and install dependencies:

```bash
# Install dependencies
npm install
```

### 2. Environment Configuration

Create a `.env` file based on the `.env.sample` template:

```bash
# Copy sample configuration
cp .env.sample .env

# Edit .env with your ERPNext instance details
# Important variables:
# - ERPNEXT_BASE_URL: Your ERPNext instance URL (e.g., http://localhost:8000)
# - ERPNEXT_API_TOKEN: (Optional) API token for backend authentication
# - ERPNEXT_API_SECRET: (Optional) API secret for token authentication
# - SYNC_INTERVAL: Data sync interval in milliseconds (default: 60000)
```

Example `.env` file:

```
ERPNEXT_BASE_URL=http://localhost:8000
ERPNEXT_API_TOKEN=your_api_token_here
ERPNEXT_API_SECRET=your_api_secret_here
SYNC_INTERVAL=60000
NODE_ENV=development
```

### 3. Running Locally

#### Development Mode

Run the application in development mode with DevTools enabled:

```bash
npm run dev
```

This will:
- Start the Electron application
- Open DevTools for debugging
- Enable hot-reload functionality (with proper setup)
- Enable detailed logging for troubleshooting

#### Production Mode

Run the application in production mode:

```bash
npm start
```

### 4. Admin Dashboard

The Admin Dashboard provides comprehensive monitoring and control of the offline synchronization system. Access it using one of these methods:

- **Keyboard Shortcut**: Press `Ctrl+Shift+A` anytime
- **Application Menu**: View → Admin Dashboard
- **Status Bar**: Click the hint in the status bar

#### Dashboard Tabs

**Sync Status Tab**
- Real-time sync state (idle/syncing/failed)
- Last sync timestamp
- Sync statistics (completed, failed, retry counts)
- Force sync and online status toggle buttons

**Queue Tab**
- List of all queued requests with method, URL, status
- Request details including creation time and retry count
- Remove individual requests capability
- Clear old requests functionality

**Conflicts Tab**
- Data conflicts requiring manual resolution
- Local vs server data comparison
- Resolution actions: Local Wins, Server Wins, Skip
- Conflict details and timestamps

**Settings Tab**
- Secure credential storage interface
- API token and secret management
- Maintenance tools for database cleanup

#### Dashboard Features
- **Auto-refresh**: Updates every 10 seconds when visible
- **Real-time updates**: Sync state changes appear immediately
- **Notifications**: Success/error messages for all actions
- **Responsive design**: Optimized for desktop monitoring

## Development Workflows

### Code Quality

#### Linting

Check for code style issues:

```bash
# Check for linting errors
npm run lint

# Fix linting errors automatically
npm run lint
```

#### Formatting

Format code according to Prettier configuration:

```bash
npm run format
```

#### Running Tests

```bash
npm test
```

## Building & Packaging

### Building for Windows

Create a production build for Windows (including both installer and portable versions):

```bash
npm run build
```

This will generate:
- An NSIS installer (`.exe`)
- A portable executable (`.exe`)

### Build Output

Built files are created in the `dist/` directory with platform-specific distributions.

## Configuration Reference

### Environment Variables

All configuration is managed through environment variables in the `.env` file:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ERPNEXT_BASE_URL` | String | `http://localhost:8000` | Base URL of your ERPNext instance |
| `ERPNEXT_API_TOKEN` | String | - | API token for ERPNext authentication |
| `ERPNEXT_API_SECRET` | String | - | API secret for token-based auth |
| `ERPNEXT_SESSION_COOKIE` | String | - | Session cookie for authentication |
| `SYNC_INTERVAL` | Number | `60000` | Interval (ms) for backend sync operations |
| `NODE_ENV` | String | `development` | Application environment mode |
| `DEBUG` | Boolean | `false` | Enable verbose debugging output |
| `PROCESSING_INTERVAL` | Number | `5000` | Queue processing interval (ms) |
| `MAX_RETRIES` | Number | `3` | Maximum retry attempts for failed requests |
| `BASE_RETRY_DELAY` | Number | `1000` | Base delay for exponential backoff (ms) |
| `MAX_RETRY_DELAY` | Number | `300000` | Maximum retry delay cap (ms) |
| `SYNC_BATCH_SIZE` | Number | `10` | Number of requests per sync batch |

## Architecture

### Main Process (`src/main.js`)

Manages:
- Application lifecycle and window creation
- IPC handlers for communication with renderer
- Configuration loading from `.env`
- Menu and system integration

### Renderer Process (`src/renderer/`)

Handles:
- User interface rendering
- ERPNext POSAwesome iframe loading
- IPC communication with main process
- Data synchronization with backend

### Preload Script (`src/preload.js`)

Provides secure:
- Context isolation between main and renderer
- Limited IPC communication channels
- Safe access to configuration and version info
- Offline interceptor IPC APIs for request queuing and credential management

### Offline Interceptor Service

The offline interceptor service provides transparent HTTP request interception:
- **HTTPInterceptor** (`src/httpInterceptor.js`): Core request interception and routing
- **OfflineQueueManager** (`src/offlineQueueManager.js`): SQLite-based persistence and request queuing
- **CredentialStore** (`src/credentialStore.js`): Secure credential storage with AES encryption
- **SyncEngine** (`src/syncEngine.js`): Background sync with exponential backoff
- **ConflictResolver** (`src/conflictResolver.js`): Conflict detection and resolution
- **Logger** (`src/logger.js`): Comprehensive logging system
- **InterceptorService** (`src/interceptorService.js`): Service orchestration and IPC handlers

See [OFFLINE_INTERCEPTOR.md](./OFFLINE_INTERCEPTOR.md) and [SYNC_ENGINE.md](./SYNC_ENGINE.md) for detailed documentation.

## Features

### ✅ Implemented

- [x] Electron main process setup
- [x] Secure renderer process with preload script
- [x] ERPNext POSAwesome iframe integration
- [x] Environment-based configuration (dotenv)
- [x] IPC communication layer
- [x] Development and production build scripts
- [x] Code linting and formatting (ESLint, Prettier)
- [x] Windows packaging support (NSIS + Portable)
- [x] Status monitoring and sync intervals
- [x] Responsive UI design
- [x] **Offline HTTP Interceptor Service**
  - [x] Request interception via preload script
  - [x] Online/offline request routing
  - [x] SQLite-based offline queue persistence
  - [x] Request deduplication via SHA256 hashing
  - [x] Secure credential storage with AES encryption
  - [x] Automatic queue processing on reconnection
  - [x] Response caching for read requests
  - [x] Retry logic with configurable max retries
  - [x] IPC APIs for queue monitoring and control
  - [x] Comprehensive logging system
  - [x] Unit tests with Vitest (88 tests)
- [x] **Sync Engine & Conflict Resolution**
  - [x] Background sync service with state management
  - [x] Exponential backoff retry logic with jitter
  - [x] Last-write-wins conflict resolution
  - [x] Custom conflict resolution hooks
  - [x] Conflict tracking in database
  - [x] Sync status broadcasting via IPC events
  - [x] Safe shutdown with graceful completion
  - [x] Resume after extended offline periods
  - [x] Integration tests for retry and conflict workflows

### 🔮 Future Enhancements

- [ ] Vue.js-based admin panel
- [ ] Extended authentication methods (OAuth, SSO)
- [ ] Platform-specific builds (macOS, Linux)
- [ ] Auto-update functionality
- [ ] Advanced error handling and recovery
- [ ] Application telemetry and analytics
- [ ] Request compression for offline storage
- [ ] Priority queue for critical requests
- [ ] Sync scheduling with user-defined windows

## Debugging

### Enable DevTools

DevTools are automatically opened in development mode. Access them via:

- **Keyboard**: `Ctrl+Shift+I` or `F12`
- **Menu**: View → Toggle Developer Tools

### Console Access

Access the renderer console through DevTools to view logs from the renderer process.

### Main Process Logging

Main process logs appear in the terminal/console where the application was launched.

## Offline Workflow

### How Offline Mode Works

POSAwesome Desktop implements a comprehensive offline-first architecture:

1. **Request Interception**: All HTTP requests to ERPNext are intercepted
2. **Request Classification**:
   - **GET/HEAD/OPTIONS**: Served from cache when offline
   - **POST/PUT/DELETE**: Queued for sync when offline
3. **Queue Processing**: Background sync service processes queued requests
4. **Conflict Resolution**: Automatic LWW (Last-Write-Wins) with manual override
5. **State Persistence**: All data stored in SQLite database for resilience

### Online/Offline Transitions

**Going Offline**:
- New POST/PUT/DELETE requests are queued
- GET requests serve from cached responses
- Visual indicators show offline status
- Automatic sync attempts continue in background

**Going Online**:
- Queued requests are processed immediately
- Conflicts are detected and logged
- Cache is updated with fresh data
- Sync status broadcasts to admin dashboard

### Data Consistency

- **Request Deduplication**: SHA256 hashing prevents duplicate submissions
- **Retry Logic**: Exponential backoff with configurable attempts (default: 3)
- **Batch Processing**: Requests processed in configurable batches (default: 10)
- **Graceful Degradation**: System continues operating during extended offline periods

### Sync Engine Behavior

- **Processing Interval**: Checks queue every 5 seconds (configurable)
- **Exponential Backoff**: 1s base delay, max 5 minutes with jitter
- **State Management**: idle → syncing → idle/failed transitions
- **Metadata Tracking**: Last sync time and statistics persisted

## Troubleshooting

### ERPNext Connection Issues

**Problem**: "Failed to load POSAwesome from [URL]"

**Solution**:
1. Verify ERPNext is running and accessible
2. Check `ERPNEXT_BASE_URL` in `.env`
3. Ensure CORS is properly configured if remote
4. Check browser console for specific errors
5. Test connectivity: `curl -I your_erpnext_url`

### Admin Dashboard Issues

**Problem**: Admin dashboard doesn't open with `Ctrl+Shift+A`

**Solution**:
1. Check browser console for JavaScript errors
2. Verify DevTools are working (development mode)
3. Try menu: View → Admin Dashboard
4. Check if preload script is loading correctly

**Problem**: Dashboard shows loading but no data

**Solution**:
1. Check main process logs for IPC errors
2. Verify offline interceptor service is initialized
3. Test IPC connectivity: Check DevTools console
4. Restart application if service failed to start

### Sync and Queue Issues

**Problem**: Requests stuck in queue indefinitely

**Solution**:
1. Open Admin Dashboard → Queue tab
2. Check for failed requests with error messages
3. Use "Force Sync" button in Sync Status tab
4. Verify ERPNext connectivity and credentials
5. Check logs: `%USERPROFILE%\AppData\Roaming\POSAwesome\logs\app.log`

**Problem**: Too many conflicts appearing

**Solution**:
1. Review conflict patterns in Admin Dashboard → Conflicts tab
2. Consider adjusting sync intervals
3. Implement custom conflict resolution hooks
4. Check for concurrent users editing same data

### Offline Cache Issues

**Problem**: Stale data being served offline

**Solution**:
1. Use Admin Dashboard → Settings → Clear Old Requests
2. Adjust cache expiry policies
3. Force sync when coming back online
4. Manually clear cache via Settings tab

### Module and Dependency Issues

**Problem**: Module not found errors during development

**Solution**:
```bash
# Clean install dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild native modules (Windows)
npm rebuild

# Clear Electron cache
# Delete: %USERPROFILE%\AppData\Roaming\POSAwesome\Cache
```

### Port and Network Issues

**Problem**: Port conflicts or network timeouts

**Solution**:
```bash
# Windows: Check port usage
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Test ERPNext connectivity
curl -I http://your-erpnext-url/api/method/frappe.client.get_user

# Check Windows Firewall settings
# Ensure ERPNext URL is whitelisted
```

### Windows Development and Testing

#### Prerequisites for Windows Development

1. **Node.js**: Download from nodejs.org (LTS recommended)
2. **Git**: Git for Windows with Git Bash
3. **Visual Studio Build Tools**: For native module compilation
4. **Windows Terminal**: Enhanced command line experience

#### Development Setup on Windows

```powershell
# Clone repository
git clone <repository-url>
cd posawsome-desktop

# Install dependencies
npm install

# Start development mode
npm run dev
```

#### Testing Windows Builds

```powershell
# Build Windows installer and portable
npm run build

# Test installer
# Located in dist/ directory

# Test portable version
# Run POSAwesome-0.1.0.exe directly

# Check build integrity
Get-FileHash dist\POSAwesome-Setup-0.1.0.exe
```

#### Windows-Specific Issues

**Problem**: Electron app won't start on Windows

**Solutions**:
1. Run as Administrator
2. Check Windows Defender exclusions
3. Verify Visual C++ Redistributable installed
4. Check Windows version compatibility (Windows 7+)

**Problem**: Database permission errors

**Solution**:
```powershell
# Fix SQLite database permissions
# Location: %USERPROFILE%\AppData\Roaming\POSAwesome\
icacls offline-queue.db /grant Users:F
```

**Problem**: Credential storage errors

**Solution**:
1. Check Windows Data Protection API availability
2. Verify user profile integrity
3. Run as current user, not system account
4. Clear credential store via Admin Dashboard → Settings

#### Windows Performance Considerations

- **SQLite Performance**: Use SSD storage for better database performance
- **Memory Usage**: Monitor with Task Manager for memory leaks
- **Background Processes**: Sync engine runs continuously, check resource usage
- **Firewall**: Configure Windows Firewall for ERPNext connectivity

#### Windows Deployment

```powershell
# Sign application (requires code signing certificate)
# Add to build configuration in package.json

# Create installer
npm run build

# Test on clean Windows VM
# Verify all functionality works end-to-end
```

## Security Considerations

### API Token Storage

**⚠️ IMPORTANT SECURITY GUIDELINES**:

- **Never commit `.env` files** to version control
- **Use environment variables** for production deployments
- **Encrypt sensitive data** in configuration files
- **Rotate API credentials** regularly
- **Limit API permissions** to minimum required scope

### Credential Security Features

- **AES-256 Encryption**: API credentials encrypted with machine-derived key
- **Memory Protection**: Credentials cleared from memory after use
- **No Logging**: Sensitive data never logged to files
- **Secure IPC**: Only whitelisted channels for credential operations

### Environment Security

```bash
# Production environment variables
ERPNEXT_BASE_URL=https://your-production-erpnext.com
ERPNEXT_API_TOKEN=your_production_token
ERPNEXT_API_SECRET=your_production_secret

# Development environment (use test credentials)
NODE_ENV=development
DEBUG=true
```

### Additional Security Measures

1. **Network Security**: Use HTTPS for all ERPNext connections
2. **Certificate Validation**: Verify SSL certificates in production
3. **API Rate Limiting**: Implement rate limiting to prevent abuse
4. **Access Logging**: Monitor API access patterns
5. **Regular Updates**: Keep Electron and dependencies updated

### Vulnerability Reporting

For security-related issues:
1. **DO NOT** create public GitHub issues
2. **Email** security reports to: [security@posawsome.com]
3. **Include** detailed reproduction steps
4. **Allow** reasonable time for response before disclosure

### Application Security

- **Context Isolation**: Enabled to prevent direct access to Node.js APIs from renderer
- **Sandbox**: Enabled for additional security layer
- **Preload Script**: Validates all IPC channels before allowing communication
- **Environment Variables**: Sensitive credentials loaded from `.env` (not committed)

## Contributing

Guidelines for contributing to the POSAwesome Desktop project:

1. Create a feature branch from `main`
2. Follow ESLint and Prettier rules
3. Run tests before submitting PR
4. Update documentation as needed
5. Submit PR with clear description

## License

MIT License - See LICENSE file for details

## Support & Community

For issues, feature requests, or questions:
- Create an issue in the repository
- Contact the POSAwesome team
- Check existing documentation and FAQs

## Changelog

### Version 0.1.0 (Initial Release)

- Initial Electron shell setup
- ERPNext POSAwesome integration
- Environment-based configuration
- Development and build tooling
- Windows packaging support
- **🆕 Comprehensive offline mode with SQLite persistence**
- **🆕 Sync engine with exponential backoff and conflict resolution**
- **🆕 Built-in admin dashboard for monitoring and control**
- **🆕 88 comprehensive unit and integration tests**
- **🆕 Enhanced documentation with Windows development guide**

---

**Last Updated**: 2024
