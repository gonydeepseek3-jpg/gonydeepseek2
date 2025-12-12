import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { interceptorService } from './interceptorService.js';
import { logger } from './logger.js';
import { initializeDatabase } from './database/index.js';

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

app.on('ready', async () => {
  try {
    // Initialize database first
    await initializeDatabase();
    logger.info('Main', 'Database initialized successfully');

    // Initialize interceptor service
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
  } catch (error) {
    logger.error('Main', 'Failed to initialize application', { error: error.message });
    app.quit();
  }
});

app.on('window-all-closed', async () => {
  try {
    // Shutdown interceptor service first
    await interceptorService.shutdown();

    // Close database connection
    const { posDatabase } = await import('./database/db.js');
    posDatabase.close();

    logger.info('Main', 'Application shutdown completed');

    if (process.platform !== 'darwin') {
      app.quit();
    }
  } catch (error) {
    logger.error('Main', 'Error during shutdown', { error: error.message });
    if (process.platform !== 'darwin') {
      app.quit();
    }
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

// Database IPC handlers
ipcMain.handle('db-create-customer', async (event, name, email, phone) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const id = posDatabase.createCustomer(name, email, phone);
    logger.info('IPC', 'Customer created', { id, name, email });
    return { success: true, id };
  } catch (error) {
    logger.error('IPC', 'Failed to create customer', { error: error.message, name, email });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-customer', async (event, id) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const customer = posDatabase.getCustomer(id);
    return { success: true, customer };
  } catch (error) {
    logger.error('IPC', 'Failed to get customer', { error: error.message, id });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-all-customers', async () => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const customers = posDatabase.getAllCustomers();
    return { success: true, customers };
  } catch (error) {
    logger.error('IPC', 'Failed to get all customers', { error: error.message });
    return { success: false, customers: [] };
  }
});

ipcMain.handle('db-update-customer', async (event, id, name, email, phone) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    posDatabase.updateCustomer(id, name, email, phone);
    logger.info('IPC', 'Customer updated', { id, name, email });
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to update customer', { error: error.message, id });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-delete-customer', async (event, id) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    posDatabase.deleteCustomer(id);
    logger.info('IPC', 'Customer deleted', { id });
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to delete customer', { error: error.message, id });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-create-item', async (event, name, sku, price) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const id = posDatabase.createItem(name, sku, price);
    logger.info('IPC', 'Item created', { id, name, sku, price });
    return { success: true, id };
  } catch (error) {
    logger.error('IPC', 'Failed to create item', { error: error.message, name, sku });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-item', async (event, id) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const item = posDatabase.getItem(id);
    return { success: true, item };
  } catch (error) {
    logger.error('IPC', 'Failed to get item', { error: error.message, id });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-item-by-sku', async (event, sku) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const item = posDatabase.getItemBySKU(sku);
    return { success: true, item };
  } catch (error) {
    logger.error('IPC', 'Failed to get item by SKU', { error: error.message, sku });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-all-items', async () => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const items = posDatabase.getAllItems();
    return { success: true, items };
  } catch (error) {
    logger.error('IPC', 'Failed to get all items', { error: error.message });
    return { success: false, items: [] };
  }
});

ipcMain.handle('db-update-item', async (event, id, name, sku, price) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    posDatabase.updateItem(id, name, sku, price);
    logger.info('IPC', 'Item updated', { id, name, sku, price });
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to update item', { error: error.message, id });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-delete-item', async (event, id) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    posDatabase.deleteItem(id);
    logger.info('IPC', 'Item deleted', { id });
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to delete item', { error: error.message, id });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-create-invoice', async (event, name, customerId, total) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const id = posDatabase.createInvoice(name, customerId, total);
    logger.info('IPC', 'Invoice created', { id, name, customerId, total });
    return { success: true, id };
  } catch (error) {
    logger.error('IPC', 'Failed to create invoice', { error: error.message, name });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-invoice', async (event, id) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const invoice = posDatabase.getInvoice(id);
    return { success: true, invoice };
  } catch (error) {
    logger.error('IPC', 'Failed to get invoice', { error: error.message, id });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-all-invoices', async () => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const invoices = posDatabase.getAllInvoices();
    return { success: true, invoices };
  } catch (error) {
    logger.error('IPC', 'Failed to get all invoices', { error: error.message });
    return { success: false, invoices: [] };
  }
});

ipcMain.handle('db-update-invoice-status', async (event, id, status) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    posDatabase.updateInvoiceStatus(id, status);
    logger.info('IPC', 'Invoice status updated', { id, status });
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to update invoice status', { error: error.message, id, status });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-add-invoice-item', async (event, invoiceId, itemId, qty, rate) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const id = posDatabase.addInvoiceItem(invoiceId, itemId, qty, rate);
    logger.info('IPC', 'Invoice item added', { id, invoiceId, itemId, qty, rate });
    return { success: true, id };
  } catch (error) {
    logger.error('IPC', 'Failed to add invoice item', { error: error.message, invoiceId, itemId });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-invoice-items', async (event, invoiceId) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const items = posDatabase.getInvoiceItems(invoiceId);
    return { success: true, items };
  } catch (error) {
    logger.error('IPC', 'Failed to get invoice items', { error: error.message, invoiceId });
    return { success: false, items: [] };
  }
});

ipcMain.handle('db-update-invoice-total', async (event, invoiceId) => {
  try {
    const { posDatabase } = await import('./database/db.js');
    posDatabase.updateInvoiceTotal(invoiceId);
    logger.info('IPC', 'Invoice total updated', { invoiceId });
    return { success: true };
  } catch (error) {
    logger.error('IPC', 'Failed to update invoice total', { error: error.message, invoiceId });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get-stats', async () => {
  try {
    const { posDatabase } = await import('./database/db.js');
    const stats = posDatabase.getStats();
    return { success: true, stats };
  } catch (error) {
    logger.error('IPC', 'Failed to get database stats', { error: error.message });
    return { success: false, stats: {} };
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
