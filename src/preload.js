import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get environment configuration
  getConfig: () => ipcRenderer.invoke('get-env-config'),

  // Get application version
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Send message to main process
  send: (channel, args) => {
    const validChannels = ['open-url'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, args);
    }
  },

  // Listen for messages from main process
  on: (channel, callback) => {
    const validChannels = [
      'config-updated',
      'sync-state-changed',
      'sync-progress',
      'toggle-admin-dashboard',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Remove listener
  removeAllListeners: (channel) => {
    const validChannels = ['config-updated', 'sync-state-changed', 'sync-progress'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});

// Expose offline interceptor service APIs
contextBridge.exposeInMainWorld('offlineInterceptor', {
  // Credentials management
  setCredentials: (token, secret) =>
    ipcRenderer.invoke('interceptor-set-credentials', token, secret),

  getCredentials: () => ipcRenderer.invoke('interceptor-get-credentials'),

  clearCredentials: () => ipcRenderer.invoke('interceptor-clear-credentials'),

  // Queue management
  getQueueStatus: () => ipcRenderer.invoke('interceptor-get-queue-status'),

  getQueuedRequests: (limit = 50) => ipcRenderer.invoke('interceptor-get-queued-requests', limit),

  removeRequest: (id) => ipcRenderer.invoke('interceptor-remove-request', id),

  // Online/offline status
  setOnlineStatus: (isOnline) => ipcRenderer.invoke('interceptor-set-online-status', isOnline),

  // Maintenance
  clearOldRequests: (days = 7) => ipcRenderer.invoke('interceptor-clear-old-requests', days),

  // Sync management
  getSyncStatus: () => ipcRenderer.invoke('interceptor-get-sync-status'),

  forceSync: () => ipcRenderer.invoke('interceptor-force-sync'),

  // Conflict management
  getPendingConflicts: (limit = 50) =>
    ipcRenderer.invoke('interceptor-get-pending-conflicts', limit),

  resolveConflict: (conflictId, resolution) =>
    ipcRenderer.invoke('interceptor-resolve-conflict', conflictId, resolution),
});
