# POSAwesome Desktop Application

A modern Electron-based desktop application for running ERPNext POSAwesome (Point of Sale) locally with offline support and enhanced performance.

## Overview

POSAwesome Desktop provides a native desktop experience for ERPNext POS operations, enabling:

- **Local execution** of the ERPNext POSAwesome interface via Electron
- **Secure IPC communication** between main and renderer processes
- **Environment-based configuration** for ERPNext connectivity
- **Offline mode support** with automatic request queuing and synchronization
- **Automatic synchronization** with ERPNext backend
- **Secure credential storage** with AES encryption
- **SQLite-based offline request persistence** for seamless online/offline transitions
- **Foundation for future Vue-based admin panels** and customizations

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
│   │   │   └── main.css                 # Application styling
│   │   └── js/
│   │       ├── app.js                   # Renderer process JavaScript
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

#### Production Mode

Run the application in production mode:

```bash
npm start
```

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

## Troubleshooting

### ERPNext Connection Issues

**Problem**: "Failed to load POSAwesome from [URL]"

**Solution**:
1. Verify ERPNext is running and accessible
2. Check `ERPNEXT_BASE_URL` in `.env`
3. Ensure CORS is properly configured if remote
4. Check browser console for specific errors

### Module Not Found Errors

**Solution**:
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Port Already in Use

**Solution**:
```bash
# Kill process using the port (Windows)
netstat -ano | findstr :PORT
taskkill /PID <PID> /F

# Or use a different port configuration
```

## Security Considerations

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

---

**Last Updated**: 2024
