import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { interceptorService } from './interceptorService.js';
import { logger } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: path.resolve(path.dirname(__dirname), '.env') });

let mainWindow;

const isDevelopment = process.env.NODE_ENV === 'development';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  const startUrl = isDevelopment
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, 'renderer', 'index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  interceptorService.initialize();
  
  interceptorService.onSyncStateChanged((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-state-changed', data);
    }
  });

  interceptorService.onSyncProgress((data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sync-progress', data);
    }
  });

  createWindow();
});

app.on('window-all-closed', async () => {
  await interceptorService.shutdown();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for communication with renderer process
ipcMain.handle('get-env-config', () => {
  return {
    erpNextBaseUrl: process.env.ERPNEXT_BASE_URL || 'http://localhost:8000',
    syncInterval: parseInt(process.env.SYNC_INTERVAL || '60000'),
  };
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// Offline Interceptor Service IPC handlers
ipcMain.handle('interceptor-set-credentials', async (event, token, secret) => {
  try {
    const result = interceptorService.setCredentials(token, secret);
    logger.info('IPC', 'Credentials set via IPC');
    return { success: result };
  } catch (error) {
    logger.error('IPC', 'Failed to set credentials', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('interceptor-get-credentials', async () => {
  try {
    const creds = interceptorService.getCredentials();
    return creds || { token: null, secret: null };
  } catch (error) {
    logger.error('IPC', 'Failed to get credentials', { error: error.message });
    return { token: null, secret: null };
  }
});

ipcMain.handle('interceptor-clear-credentials', async () => {
  try {
    const result = interceptorService.clearCredentials();
    logger.info('IPC', 'Credentials cleared via IPC');
    return { success: result };
  } catch (error) {
    logger.error('IPC', 'Failed to clear credentials', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('interceptor-get-queue-status', async () => {
  try {
    return interceptorService.getQueueStatus();
  } catch (error) {
    logger.error('IPC', 'Failed to get queue status', { error: error.message });
    return { pending: 0, completed: 0, failed: 0, total: 0 };
  }
});

ipcMain.handle('interceptor-get-queued-requests', async (event, limit = 50) => {
  try {
    return interceptorService.getQueuedRequests(limit);
  } catch (error) {
    logger.error('IPC', 'Failed to get queued requests', { error: error.message });
    return [];
  }
});

ipcMain.handle('interceptor-remove-request', async (event, id) => {
  try {
    const result = interceptorService.removeRequest(id);
    return { success: result };
  } catch (error) {
    logger.error('IPC', 'Failed to remove request', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('interceptor-set-online-status', async (event, isOnline) => {
  try {
    interceptorService.setOnlineStatus(isOnline);
    logger.info('IPC', `Online status set to ${isOnline}`);
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to set online status', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('interceptor-clear-old-requests', async (event, days = 7) => {
  try {
    const result = interceptorService.clearOldRequests(days);
    return { success: result };
  } catch (error) {
    logger.error('IPC', 'Failed to clear old requests', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('interceptor-get-sync-status', async () => {
  try {
    return interceptorService.getSyncStatus();
  } catch (error) {
    logger.error('IPC', 'Failed to get sync status', { error: error.message });
    return {
      state: 'idle',
      isProcessing: false,
      lastSyncTime: null,
      stats: { successCount: 0, failureCount: 0, conflictCount: 0 },
      queueStats: { pending: 0, completed: 0, failed: 0, total: 0 },
      pendingConflicts: 0,
    };
  }
});

ipcMain.handle('interceptor-force-sync', async () => {
  try {
    interceptorService.forceSync();
    logger.info('IPC', 'Force sync triggered');
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to force sync', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('interceptor-get-pending-conflicts', async (event, limit = 50) => {
  try {
    return interceptorService.getPendingConflicts(limit);
  } catch (error) {
    logger.error('IPC', 'Failed to get pending conflicts', { error: error.message });
    return [];
  }
});

ipcMain.handle('interceptor-resolve-conflict', async (event, conflictId, resolution) => {
  try {
    const result = interceptorService.resolveConflict(conflictId, resolution);
    logger.info('IPC', 'Conflict resolved', { conflictId, resolution });
    return { success: result };
  } catch (error) {
    logger.error('IPC', 'Failed to resolve conflict', { error: error.message });
    return { success: false, error: error.message };
  }
});

// Create application menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
      { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { role: 'reload' }, 
      { role: 'forceReload' }, 
      { role: 'toggleDevTools' },
      { type: 'separator' },
      {
        label: 'Admin Dashboard',
        accelerator: 'Ctrl+Shift+A',
        click: () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('toggle-admin-dashboard');
          }
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);
