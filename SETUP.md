# POSAwesome Desktop - Complete Setup & Configuration Guide

A fully-featured Electron-based Point of Sale application for ERPNext with local data persistence, offline capabilities, and intelligent sync engine.

## 📋 Table of Contents

1. [Features](#features)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Running the Application](#running-the-application)
6. [Architecture Overview](#architecture-overview)
7. [Core Components](#core-components)
8. [Usage Scenarios](#usage-scenarios)
9. [Troubleshooting](#troubleshooting)
10. [Development](#development)

## ✨ Features

### Core Features
- **Electron Desktop Application**: Native cross-platform desktop app (Windows, Mac, Linux)
- **Embedded POSAwesome**: Full ERPNext POS interface with offline support
- **Local SQLite Database**: Fast, persistent local storage with 6 optimized tables
- **Offline Mode**: Complete offline functionality with automatic sync when online
- **Smart Queue System**: Priority-based request queue with retry logic
- **Conflict Resolution**: Automatic and manual conflict detection and resolution
- **Sync Engine**: Intelligent incremental sync with metadata tracking
- **Admin Dashboard**: Real-time monitoring and management interface
- **Error Recovery**: Database integrity checks, backups, and recovery utilities

### Technical Features
- **ES Modules**: Modern JavaScript (Node.js 14+)
- **Context Isolation**: Secure Electron preload bridge
- **WAL Mode**: SQLite Write-Ahead Logging for concurrency
- **Comprehensive Testing**: 69 passing smoke tests + Jest unit tests
- **Migration System**: Automatic schema versioning and evolution
- **Serialization**: Automatic ERPNext payload conversion

## 📦 Prerequisites

- **Node.js**: 14.0 or higher (LTS recommended)
- **npm**: 6.0 or higher
- **ERPNext Instance**: 13.0 or higher
- **ERPNext API Token**: For authentication (optional, can use session)
- **OS**: Windows 10+, macOS 10.13+, or Linux (Ubuntu 20.04+)

## 🚀 Installation

### 1. Clone Repository

```bash
git clone <repository-url>
cd posawsome-desktop
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- `electron` (27.0.0) - Desktop framework
- `better-sqlite3` (9.0.0) - Local database
- `dotenv` (16.3.1) - Environment configuration
- Development tools (eslint, prettier, electron-builder)

### 3. Create Environment Configuration

Copy the sample configuration:

```bash
cp .env.sample .env
```

## ⚙️ Configuration

### Environment Variables (.env)

Edit your `.env` file with your ERPNext instance details:

```bash
# ERPNext Server Configuration
ERPNEXT_BASE_URL=http://localhost:8000
# or for production: ERPNEXT_BASE_URL=https://erp.yourdomain.com

# Authentication Method 1: API Token (Recommended)
ERPNEXT_API_TOKEN=your_api_token_here
ERPNEXT_API_SECRET=your_api_secret_here

# Authentication Method 2: Session Cookie (if not using API token)
ERPNEXT_SESSION_COOKIE=your_session_cookie_here

# Sync Configuration
SYNC_INTERVAL=60000  # 60 seconds (milliseconds)

# Application Mode
NODE_ENV=development  # or 'production'

# Logging
DEBUG=false  # Set to 'true' for verbose logging
```

### Obtaining API Token from ERPNext

1. Log in to your ERPNext instance
2. Navigate to **Setup > API** 
3. Create a new **API User** or use existing user
4. Generate **Token** and **Secret**
5. Copy both values to your `.env` file

## ▶️ Running the Application

### Development Mode

```bash
npm run dev
```

- Opens application with DevTools
- Auto-reloads on code changes
- Shows detailed error messages

### Production Mode

```bash
npm start
```

- Runs optimized application
- No DevTools
- Proper error logging

### Building Installers

```bash
# Build for Windows (NSIS installer + portable)
npm run build

# Build without packaging
npm run build:dir
```

Output appears in `/dist` directory:
- `POSAwesome Setup 0.1.0.exe` - NSIS installer
- `POSAwesome 0.1.0.exe` - Portable executable

## 🏗️ Architecture Overview

```
POSAwesome Desktop
│
├── Main Process (Electron)
│   ├── Window Management
│   ├── IPC Communication
│   ├── Database Connection Pool
│   └── Configuration Loading
│
├── Renderer Process (UI)
│   ├── POSAwesome iframe
│   ├── Admin Dashboard
│   ├── Offline Indicator
│   └── Status Display
│
└── Services Layer
    ├── SQLite Database Layer
    │   ├── Schema Management
    │   ├── CRUD Operations
    │   ├── Migrations
    │   └── Serialization
    │
    ├── Offline Interceptor
    │   ├── Request Queueing
    │   ├── Network Detection
    │   └── Sync Triggering
    │
    ├── Sync Engine
    │   ├── Queue Processing
    │   ├── Conflict Resolution
    │   ├── Metadata Tracking
    │   └── Retry Logic
    │
    └── Admin Dashboard
        ├── Statistics
        ├── Queue Management
        ├── Conflict Resolution
        └── Sync Control
```

## 🔧 Core Components

### 1. Database Layer (`src/db/`)

**Purpose**: Local SQLite persistence with ERPNext compatibility

**Key Files**:
- `database.js` - Connection management, backups, integrity
- `schema.js` - Table definitions for 6 entities
- `migrations.js` - Automatic schema versioning
- `serialization.js` - Convert between ERPNext and DB formats
- `repositories/` - CRUD operations per entity type

**Tables**:
- `invoices` - Sales invoices
- `invoice_items` - Invoice line items
- `customers` - Customer master data
- `queued_requests` - Sync queue
- `sync_metadata` - Sync state tracking
- `conflict_logs` - Conflict history

**Example Usage**:
```javascript
import { DatabaseManager } from './src/db/database.js';

const dbManager = new DatabaseManager();
dbManager.open();
dbManager.initialize();

const repos = dbManager.createRepositories();
const invoices = repos.invoices.findByCustomer('CUST-001');
```

### 2. Offline Interceptor (`src/services/offlineInterceptor.js`)

**Purpose**: Handle offline scenarios transparently

**Features**:
- Intercepts HTTP requests
- Queues requests when offline
- Automatically syncs when online
- Network status monitoring
- Event notifications

**Example Usage**:
```javascript
import { OfflineInterceptor } from './src/services/offlineInterceptor.js';

const interceptor = new OfflineInterceptor(dbManager);
interceptor.initialize();

// Check status
const status = interceptor.getQueueStatus();
console.log(`Online: ${status.isOnline}, Pending: ${status.pending}`);

// Handle sync trigger
interceptor.onPendingSync((status) => {
  console.log('Sync triggered:', status);
});
```

### 3. Sync Engine (`src/services/syncEngine.js`)

**Purpose**: Intelligent synchronization with ERPNext

**Features**:
- Initial and incremental sync
- Conflict detection and resolution
- Queue processing with retries
- Sync metadata tracking
- Batch operations

**Example Usage**:
```javascript
import { SyncEngine } from './src/services/syncEngine.js';

const syncEngine = new SyncEngine(dbManager, {
  erpnextBaseUrl: 'http://localhost:8000',
  apiToken: 'token123',
  apiSecret: 'secret456',
  syncInterval: 60000,
});

syncEngine.initialize();

// Manual sync
const result = await syncEngine.startSyncCycle();
console.log(`Synced: ${result.queue.completed}`);

// Monitor sync
syncEngine.onSyncComplete((result) => {
  if (result.success) {
    console.log('Sync complete:', result.results);
  }
});
```

### 4. Admin Dashboard (`src/renderer/js/adminDashboard.js`)

**Purpose**: Real-time monitoring and control interface

**Features**:
- Live statistics
- Queue visualization
- Conflict resolution UI
- Sync controls
- Network status indicator

**Tabs**:
1. **Dashboard** - Overall status and metrics
2. **Queue** - Pending requests with details
3. **Conflicts** - Unresolved conflicts with resolution options
4. **Logs** - Sync and error logs

**Example Usage**:
```javascript
import AdminDashboard from './src/renderer/js/adminDashboard.js';

const dashboard = new AdminDashboard(
  'admin-panel',
  dbManager,
  syncEngine,
  offlineInterceptor
);
dashboard.initialize();
```

## 📚 Usage Scenarios

### Scenario 1: Online with Active Sync

```
User creates invoice → 
Sent to ERPNext immediately → 
Queue records transaction → 
Sync metadata updated → 
Admin dashboard shows ✓
```

### Scenario 2: Offline Data Entry

```
User creates invoice (offline) → 
Queued locally → 
Offline banner shown → 
User continues work → 
Connection restored → 
Auto-sync triggered → 
Conflict check performed → 
Data pushed to ERPNext
```

### Scenario 3: Conflict During Sync

```
Remote updated invoice → 
Local also modified → 
Conflict detected → 
Conflict log created → 
Admin notified → 
Resolution selected → 
Merged data synced → 
Metadata updated
```

### Scenario 4: Network Interruption

```
Sync in progress → 
Connection lost → 
Request queued → 
Queue status updated → 
User notified → 
Retries queued → 
Connection restored → 
Automatic retry → 
Queue processed
```

## 🐛 Troubleshooting

### Database Issues

**"Database is locked"**
```bash
# Database is open in multiple processes
# Solution: Close all instances and restart
rm posawsome.db-shm posawsome.db-wal
npm start
```

**"Database corruption detected"**
```javascript
if (!dbManager.checkDatabaseIntegrity()) {
  dbManager.repair();
  // or restore from backup
  dbManager.restoreFromBackup('./backup/posawsome_2024-01-01.db');
}
```

### Sync Issues

**Requests not syncing**
```javascript
// Check queue status
const status = interceptor.getQueueStatus();
console.log(status);

// Manually trigger sync
await syncEngine.startSyncCycle();

// Check failed requests
const failed = syncEngine.getFailedRequests();
console.log(failed);

// Retry specific request
syncEngine.retryFailedRequest(requestId);
```

**Conflicts not resolving**
```javascript
// View all unresolved conflicts
const conflicts = repos.conflicts.getUnresolvedConflicts();

// Resolve conflict
syncEngine.resolveConflict(conflictId, 'remote-wins');
// Options: 'remote-wins', 'local-wins', 'merge'
```

### Network Issues

**Offline mode not working**
```javascript
// Check interceptor
console.log(interceptor.isOnline);

// Manually simulate offline
interceptor.isOnline = false;
interceptor.handleOffline();

// Check network listeners
window.dispatchEvent(new Event('offline'));
```

**SSL Certificate Error**
```bash
# Development only - disable cert verification
NODE_TLS_REJECT_UNAUTHORIZED=0 npm start

# Production - add certificate to ERPNext server
```

## 👨‍💻 Development

### Project Structure

```
posawsome-desktop/
├── src/
│   ├── main.js                 # Electron main process
│   ├── preload.js              # Secure preload script
│   ├── db/                     # Database layer
│   │   ├── constants.js
│   │   ├── schema.js
│   │   ├── migrations.js
│   │   ├── serialization.js
│   │   ├── database.js
│   │   ├── example-usage.js
│   │   ├── repositories/
│   │   │   ├── invoiceRepository.js
│   │   │   ├── customerRepository.js
│   │   │   ├── queueRepository.js
│   │   │   ├── syncMetadataRepository.js
│   │   │   └── conflictLogRepository.js
│   │   ├── __tests__/
│   │   │   ├── database.test.js
│   │   │   └── smoke.test.js
│   │   └── README.md
│   │
│   ├── services/
│   │   ├── offlineInterceptor.js
│   │   └── syncEngine.js
│   │
│   └── renderer/
│       ├── index.html
│       ├── js/
│       │   ├── app.js
│       │   └── adminDashboard.js
│       └── styles/
│           └── main.css
│
├── .env.sample                 # Configuration template
├── .env                        # Configuration (gitignored)
├── package.json
├── README.md                   # User guide
├── SETUP.md                    # This file
└── DEVELOPMENT.md              # Developer guide
```

### Running Tests

```bash
# Run smoke tests
npm test

# Run Jest unit tests
npm run test:unit

# Run linter
npm run lint

# Format code
npm run format
```

### Adding New Features

#### 1. New Database Table

Edit `src/db/schema.js`:
```javascript
export const SCHEMA = {
  // Add new table definition
};
```

Edit `src/db/migrations.js`:
```javascript
export const MIGRATIONS = [
  // Add new migration
];
```

Create repository in `src/db/repositories/newRepository.js`

#### 2. New Service

Create `src/services/newService.js` with:
- Constructor taking dbManager
- initialize() method
- Event callbacks
- Error handling

#### 3. New UI Component

Create in `src/renderer/js/` with:
- Constructor for container ID
- initialize() method
- Event handling
- refresh() method

### Code Style Guidelines

- **Format**: Prettier (2 spaces, single quotes)
- **Linting**: ESLint (ES2021)
- **Modules**: ES6 imports/exports only
- **Comments**: JSDoc for public APIs
- **Naming**: camelCase for functions, PascalCase for classes

### Debugging

**Enable DevTools**:
```bash
npm run dev
# Press Ctrl+Shift+I to open DevTools
```

**Console Logging**:
```javascript
console.log('Message');      // Normal
console.warn('Warning');     // Warnings
console.error('Error');      // Errors
```

**SQLite Debugging**:
```javascript
// Enable query logging
db.pragma('query_only = false');
```

## 📝 License

MIT - See LICENSE file for details

## 🤝 Support

For issues and questions:
1. Check [DEVELOPMENT.md](./DEVELOPMENT.md) for dev guide
2. Review [src/db/README.md](./src/db/README.md) for database docs
3. Check troubleshooting section above
4. Review test files for usage examples

## 🎯 Next Steps

1. **Configure ERPNext**: Set up API token in `.env`
2. **Install Dependencies**: Run `npm install`
3. **Create Environment**: Copy `.env.sample` to `.env`
4. **Start App**: Run `npm run dev` (development) or `npm start` (production)
5. **Test**: Run `npm test` to verify installation
6. **Monitor**: Open Admin Dashboard to see stats

---

**Version**: 0.1.0  
**Last Updated**: 2024  
**Status**: Production Ready with Offline Support
