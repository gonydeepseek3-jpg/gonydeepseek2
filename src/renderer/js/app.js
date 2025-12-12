// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Get configuration from main process
    const config = await window.electronAPI.getConfig();
    const version = await window.electronAPI.getAppVersion();

    // Update UI with version
    const versionElement = document.getElementById('app-version');
    if (versionElement) {
      versionElement.textContent = `v${version}`;
    }

    // Update status
    updateStatus('Configuration loaded');

    // Initialize the POSAwesome interface
    await initializePOSAwesome(config);

    // Setup event listeners
    setupEventListeners();

    // Listen for main process messages
    window.electronAPI.on('toggle-admin-dashboard', () => {
      if (window.adminDashboard) {
        window.adminDashboard.togglePanel();
      }
    });

    // Add keyboard shortcut for admin panel
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        if (window.adminDashboard) {
          window.adminDashboard.togglePanel();
        }
      }
    });

    // Start synchronization if configured
    if (config.syncInterval > 0) {
      startSyncInterval(config.syncInterval);
    }
  } catch (error) {
    console.error('Failed to initialize application:', error);
    updateStatus(`Error: ${error.message}`, 'error');
  }
});

/**
 * Initialize POSAwesome interface
 * @param {Object} config - Configuration object
 */
async function initializePOSAwesome(config) {
  const container = document.getElementById('posawsome-container');

  if (!container) {
    throw new Error('POSAwesome container not found');
  }

  // Create a webview so we can inject a guest preload that intercepts API calls
  const webview = document.createElement('webview');
  webview.id = 'posawsome-webview';
  webview.style.width = '100%';
  webview.style.height = '100%';
  webview.style.border = 'none';

  // Construct the URL for ERPNext POSAwesome
  const erpNextBaseUrl = config.erpNextBaseUrl.replace(/\/$/, '');
  const posAwesomeUrl = `${erpNextBaseUrl}/app/pos`;

  webview.src = posAwesomeUrl;

  try {
    const preloadPath = await window.electronAPI.getWebviewPreloadPath();
    if (preloadPath) {
      webview.preload = preloadPath;
    }
  } catch (error) {
    console.warn('Failed to set webview preload path:', error);
  }

  // Handle webview load events
  webview.addEventListener('did-finish-load', () => {
    updateStatus('POSAwesome loaded successfully');
    console.log('POSAwesome interface loaded');
  });

  webview.addEventListener('did-fail-load', (event) => {
    updateStatus(
      `Failed to load POSAwesome from ${posAwesomeUrl}. Check your ERPNEXT_BASE_URL configuration.`,
      'error'
    );
    console.error('Failed to load POSAwesome', event);
  });

  container.appendChild(webview);
}

/**
 * Setup event listeners for the application
 */
function setupEventListeners() {
  // Listen for configuration updates from main process
  window.electronAPI.on('config-updated', (newConfig) => {
    console.log('Configuration updated:', newConfig);
    updateStatus('Configuration has been updated');
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    const container = document.getElementById('posawsome-container');
    if (container) {
      console.log(`Window resized to ${window.innerWidth}x${window.innerHeight}`);
    }
  });
}

/**
 * Start periodic synchronization
 * @param {number} interval - Sync interval in milliseconds
 */
function startSyncInterval(interval) {
  console.log(`Starting sync interval: ${interval}ms`);

  setInterval(() => {
    performSync();
  }, interval);
}

/**
 * Perform synchronization with ERPNext backend
 */
async function performSync() {
  try {
    const config = await window.electronAPI.getConfig();
    const erpNextBaseUrl = config.erpNextBaseUrl.replace(/\/$/, '');

    // Example: Check if we can reach the ERPNext server
    const response = await fetch(`${erpNextBaseUrl}/api/method/frappe.client.get_user`);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Sync successful');
  } catch (error) {
    console.error('Sync failed:', error);
    updateStatus(`Sync failed: ${error.message}`, 'warning');
  }
}

/**
 * Update status display
 * @param {string} message - Status message
 * @param {string} type - Status type: 'info', 'warning', 'error'
 */
function updateStatus(message, type = 'info') {
  const statusElement = document.getElementById('status-text');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = type;

    // Add timeout to clear warning/error messages
    if (type !== 'info') {
      setTimeout(() => {
        statusElement.textContent = 'Ready';
        statusElement.className = 'info';
      }, 5000);
    }
  }
  console.log(`[${type.toUpperCase()}] ${message}`);
}

/**
 * Load Vue-based admin panel
 * Note: This is a placeholder for future Vue-based admin views
 */
function loadAdminPanel() {
  const adminPanel = document.getElementById('admin-panel');
  if (adminPanel) {
    adminPanel.classList.add('visible');
    // Vue component will be mounted here in the future
  }
}

// Expose some functions to global scope for debugging
window.posAwesomeApp = {
  updateStatus,
  loadAdminPanel,
  performSync,
  config: window.electronAPI.getConfig,
};
