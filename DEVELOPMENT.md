# Development Guide

This guide provides detailed information for developers working on the POSAwesome Desktop application.

## Prerequisites

- **Node.js**: v16.0.0 or higher
- **npm**: v7.0.0 or higher
- **Git**: Latest version
- **Visual Studio Code** (recommended) or any code editor

## Initial Setup

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-org/posawsome-desktop.git
cd posawsome-desktop

# Install dependencies
npm install
```

### 2. Environment Configuration

```bash
# Create .env file from sample
cp .env.sample .env

# Edit .env with your local ERPNext instance
# For local development with ERPNext on localhost:8000:
# ERPNEXT_BASE_URL=http://localhost:8000
# NODE_ENV=development
```

### 3. Verify Setup

```bash
# Run linting to check code quality
npm run lint

# Start the application
npm run dev
```

## Development Workflow

### Running in Development Mode

```bash
npm run dev
```

Features:
- DevTools automatically opens for debugging
- Hot-reload ready (with proper setup)
- Full error reporting
- Verbose logging

### Making Code Changes

#### Adding a New Feature

1. Create a feature branch:
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. Make your changes following the existing code patterns

3. Format and lint your code:
   ```bash
   npm run lint
   npm run format
   ```

4. Test your changes:
   ```bash
   npm run dev
   ```

5. Commit with a descriptive message:
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

#### Code Style and Conventions

- **Language**: Modern JavaScript (ES6+)
- **Module System**: ES modules (import/export)
- **Line Length**: Maximum 100 characters (see .prettierrc)
- **Indentation**: 2 spaces
- **Quotes**: Single quotes
- **Semicolons**: Required

Example:
```javascript
import { ipcRenderer } from 'electron';

// Good: Clear naming, proper formatting
async function fetchUserConfig() {
  const config = await window.electronAPI.getConfig();
  return {
    baseUrl: config.erpNextBaseUrl,
    syncInterval: config.syncInterval,
  };
}
```

### Architecture Overview

#### Electron Main Process (src/main.js)

Responsibilities:
- Create and manage BrowserWindow
- Load environment configuration from .env
- Set up IPC handlers for renderer communication
- Manage application lifecycle
- Configure application menu

Key components:
- `createWindow()`: Sets up the main application window
- IPC handlers: `get-env-config`, `get-app-version`
- Menu setup: File, Edit, View menus

#### Preload Script (src/preload.js)

Provides secure bridge between:
- Main process (Node.js environment)
- Renderer process (Browser environment)

Exposed APIs:
- `electronAPI.getConfig()`: Fetch environment configuration
- `electronAPI.getAppVersion()`: Get application version
- `electronAPI.send()`: Send message to main process
- `electronAPI.on()`: Listen for messages from main process

#### Renderer Process (src/renderer/)

Structure:
```
src/renderer/
├── index.html          # Main HTML template
├── styles/
│   └── main.css       # Application styling
└── js/
    └── app.js         # Main application logic
```

Key responsibilities:
- Load and initialize UI
- Fetch configuration from main process
- Load ERPNext POSAwesome in iframe
- Handle user interactions
- Manage periodic synchronization

### IPC Communication

#### From Renderer to Main (Invoke)

```javascript
// Renderer process
const config = await window.electronAPI.getConfig();
console.log(config.erpNextBaseUrl);
```

#### From Main to Renderer (Handle)

```javascript
// Main process (src/main.js)
ipcMain.handle('get-env-config', () => {
  return {
    erpNextBaseUrl: process.env.ERPNEXT_BASE_URL,
    syncInterval: parseInt(process.env.SYNC_INTERVAL),
  };
});
```

### Working with Environment Variables

#### Adding New Configuration

1. Add to `.env.sample`:
   ```
   MY_NEW_CONFIG=default_value
   ```

2. Load in `main.js`:
   ```javascript
   const myConfig = process.env.MY_NEW_CONFIG;
   ```

3. Expose via IPC if needed:
   ```javascript
   ipcMain.handle('get-my-config', () => ({
     myConfig: process.env.MY_NEW_CONFIG,
   }));
   ```

4. Access in renderer:
   ```javascript
   const { myConfig } = await window.electronAPI.getConfig();
   ```

### Building and Packaging

#### Development Build

```bash
# Build directory (for testing)
npm run build:dir
```

#### Production Build

```bash
# Create installer and portable executable for Windows
npm run build
```

Output in `dist/`:
- `POSAwesome Setup 0.1.0.exe` - NSIS installer
- `POSAwesome 0.1.0.exe` - Portable executable

### Debugging

#### DevTools

In development mode, DevTools opens automatically. Use it to:
- Inspect DOM elements
- Check console for errors/logs
- Debug JavaScript code
- Profile performance

#### Main Process Debugging

Main process logs appear in the terminal where you ran `npm run dev`:

```bash
# Example output
Main process starting...
Window created
IPC handler registered: get-env-config
```

#### Renderer Process Debugging

View renderer logs in DevTools Console or programmatically:

```javascript
// Log message that appears in DevTools
console.log('POSAwesome loading...');

// Use the exposed debug API
window.posAwesomeApp.updateStatus('Status message');
```

### Testing

#### Code Quality Checks

```bash
# Run ESLint
npm run lint

# Run Prettier check
npm run format

# Run tests
npm test
```

#### Manual Testing Checklist

- [ ] Application starts without errors
- [ ] ERPNext POSAwesome loads in iframe
- [ ] DevTools opens in development mode
- [ ] Configuration is properly loaded
- [ ] IPC communication works
- [ ] Sync interval initiates properly
- [ ] Window resizes correctly
- [ ] Application menu functions properly

### Common Development Tasks

#### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update specific package
npm install package-name@latest

# Update all packages
npm update
```

#### Adding a New Script

1. Add to `package.json` scripts:
   ```json
   "scripts": {
     "my-script": "node path/to/script.js"
   }
   ```

2. Run with:
   ```bash
   npm run my-script
   ```

#### Handling Errors

Example error handling pattern:

```javascript
try {
  const config = await window.electronAPI.getConfig();
  // Use config
} catch (error) {
  console.error('Failed to load config:', error);
  updateStatus(`Error: ${error.message}`, 'error');
}
```

### Future Development - Vue Admin Panel

When implementing Vue-based admin views:

1. Install Vue and build tools:
   ```bash
   npm install vue webpack webpack-cli
   ```

2. Create component structure:
   ```
   src/admin/
   ├── components/
   │   ├── Dashboard.vue
   │   ├── Settings.vue
   │   └── ...
   ├── views/
   │   └── AdminPanel.vue
   └── main.js
   ```

3. Mount Vue app:
   ```javascript
   // In src/renderer/js/app.js
   const adminPanel = document.getElementById('admin-panel');
   if (adminPanel) {
     // Mount Vue app here
   }
   ```

### Git Workflow

#### Branch Naming

- `feat/feature-name` - New features
- `fix/bug-name` - Bug fixes
- `docs/documentation` - Documentation updates
- `refactor/component-name` - Code refactoring
- `test/test-name` - Test additions

#### Commit Message Format

```
<type>: <subject>

<body>

<footer>
```

Examples:
```
feat: add Vue admin panel component

fix: resolve IPC communication timeout issue

docs: update development guide with examples
```

### Troubleshooting Development Issues

#### "Cannot find module 'electron'"

```bash
# Reinstall dependencies
npm install

# Rebuild native modules if needed
npm rebuild
```

#### Port conflicts

```bash
# Check what's using port 3000 (if using dev server)
lsof -i :3000
# Kill the process
kill -9 <PID>
```

#### ESLint errors on startup

```bash
# Fix all auto-fixable issues
npm run lint

# Check specific file
npx eslint src/main.js
```

#### Prettier formatting conflicts

```bash
# Format all files
npm run format

# Check Prettier formatting
npx prettier --check src
```

### Performance Optimization Tips

1. **Lazy load heavy components** - Defer loading of admin panel until needed
2. **Minimize IPC calls** - Cache configuration data when possible
3. **Use debouncing** - For frequent synchronization calls
4. **Profile with DevTools** - Check performance tab for bottlenecks

### Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [ERPNext Documentation](https://docs.erpnext.com/)
- [Electron Security](https://www.electronjs.org/docs/tutorial/security)

---

For questions or issues, please open an issue on the repository or contact the development team.
