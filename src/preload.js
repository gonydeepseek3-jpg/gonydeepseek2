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
    const validChannels = ['config-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Remove listener
  removeAllListeners: (channel) => {
    const validChannels = ['config-updated'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
});
