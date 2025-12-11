# POSAwesome Desktop Application

A modern Electron-based desktop application for running ERPNext POSAwesome (Point of Sale) locally with offline support and enhanced performance.

## Overview

POSAwesome Desktop provides a native desktop experience for ERPNext POS operations, enabling:

- **Local execution** of the ERPNext POSAwesome interface via Electron
- **Secure IPC communication** between main and renderer processes
- **Environment-based configuration** for ERPNext connectivity
- **Automatic synchronization** with ERPNext backend
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
│   ├── main.js                      # Electron main process
│   ├── preload.js                   # Secure IPC preload script
│   │
│   ├── db/                          # SQLite Data Layer
│   │   ├── database.js              # Database manager
│   │   ├── schema.js                # Table schemas
│   │   ├── migrations.js            # Migration system
│   │   ├── serialization.js         # ERPNext payload conversion
│   │   ├── constants.js             # Enums and constants
│   │   ├── example-usage.js         # Usage examples
│   │   ├── README.md                # Database documentation
│   │   ├── repositories/            # CRUD operations
│   │   │   ├── invoiceRepository.js
│   │   │   ├── invoiceItemRepository.js
│   │   │   ├── customerRepository.js
│   │   │   ├── queueRepository.js
│   │   │   ├── syncMetadataRepository.js
│   │   │   └── conflictLogRepository.js
│   │   └── __tests__/               # Database tests
│   │       ├── database.test.js     # Jest unit tests
│   │       └── smoke.test.js        # 69 passing smoke tests
│   │
│   ├── services/
│   │   ├── offlineInterceptor.js    # Request queueing for offline
│   │   └── syncEngine.js            # Sync with ERPNext
│   │
│   └── renderer/
│       ├── index.html               # Main renderer HTML
│       ├── styles/
│       │   └── main.css             # Application styling
│       └── js/
│           ├── app.js               # Renderer process JavaScript
│           └── adminDashboard.js    # Admin dashboard UI
│
├── package.json                     # Project dependencies and scripts
├── .env.sample                      # Sample environment configuration
├── .env                             # Environment configuration (gitignored)
├── .eslintrc.json                   # ESLint configuration
├── .prettierrc                      # Prettier code formatting config
├── .gitignore                       # Git ignore rules
├── README.md                        # This file (main guide)
├── SETUP.md                         # Complete setup & configuration
└── DEVELOPMENT.md                   # Developer guide
```

## Quick Start

For detailed setup instructions including database configuration and troubleshooting, see [SETUP.md](./SETUP.md).

### 1. Installation

Clone the repository and install dependencies:

```bash
# Install dependencies
npm install

# Run tests to verify installation
npm test
```

### 2. Environment Configuration

Create a `.env` file based on the `.env.sample` template:

```bash
# Copy sample configuration
cp .env.sample .env

# Edit .env with your ERPNext instance details
# Important variables:
# - ERPNEXT_BASE_URL: Your ERPNext instance URL (e.g., http://localhost:8000)
# - ERPNEXT_API_TOKEN: API token for backend authentication
# - ERPNEXT_API_SECRET: API secret for token authentication
# - SYNC_INTERVAL: Data sync interval in milliseconds (default: 60000)
```

Example `.env` file:

```
ERPNEXT_BASE_URL=http://localhost:8000
ERPNEXT_API_TOKEN=your_api_token_here
ERPNEXT_API_SECRET=your_api_secret_here
SYNC_INTERVAL=60000
NODE_ENV=development
DEBUG=false
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

## Architecture

### Main Process (`src/main.js`)

Manages:
- Application lifecycle and window creation
- IPC handlers for communication with renderer
- Configuration loading from `.env`
- Menu and system integration
- Database initialization

### Renderer Process (`src/renderer/`)

Handles:
- User interface rendering
- ERPNext POSAwesome iframe loading
- IPC communication with main process
- Offline interceptor for request queuing
- Admin dashboard for monitoring

### Preload Script (`src/preload.js`)

Provides secure:
- Context isolation between main and renderer
- Limited IPC communication channels
- Safe access to configuration and version info

### Database Layer (`src/db/`)

Provides:
- Local SQLite persistence with 6 optimized tables
- Automatic schema initialization with migrations
- Repository pattern for CRUD operations
- Serialization/deserialization for ERPNext compatibility
- Transaction support and integrity checks

### Offline Interceptor (`src/services/offlineInterceptor.js`)

Handles:
- HTTP request interception
- Automatic request queuing when offline
- Network status monitoring
- Event-based sync triggering
- Queue status and management

### Sync Engine (`src/services/syncEngine.js`)

Manages:
- Initial and incremental synchronization
- Conflict detection and resolution
- Queue processing with retry logic
- Sync metadata tracking
- Batch operations

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
- [x] **SQLite Data Layer** - Local persistence with 6 optimized tables
- [x] **Offline Interceptor** - Request queueing for offline scenarios
- [x] **Sync Engine** - Intelligent incremental sync with conflict resolution
- [x] **Admin Dashboard** - Real-time monitoring and control UI
- [x] **Comprehensive Testing** - 69 passing smoke tests + Jest unit tests
- [x] **Error Recovery** - Database integrity checks and repair utilities
- [x] **Complete Documentation** - SETUP.md, DEVELOPMENT.md, src/db/README.md

### 🔮 Future Enhancements

- [ ] Vue.js-based advanced admin features
- [ ] Extended authentication methods (OAuth, SSO)
- [ ] Platform-specific builds (macOS, Linux)
- [ ] Auto-update functionality
- [ ] Application telemetry and analytics
- [ ] Mobile app for offline sync

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
