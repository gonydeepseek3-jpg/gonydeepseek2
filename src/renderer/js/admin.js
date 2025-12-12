/**
 * Admin Dashboard Module
 * Lightweight vanilla JavaScript admin panel for POSAwesome Desktop
 * Provides sync status monitoring, queue management, and conflict resolution
 */

class AdminDashboard {
  constructor() {
    this.refreshInterval = null;
    this.isVisible = false;
    this.currentTab = 'status';
    
    this.init();
  }

  init() {
    this.createAdminPanel();
    this.setupEventListeners();
    this.startAutoRefresh();
  }

  /**
   * Create the admin panel DOM structure
   */
  createAdminPanel() {
    const adminPanel = document.getElementById('admin-panel');
    if (!adminPanel) {
      console.error('Admin panel container not found');
      return;
    }

    adminPanel.innerHTML = `
      <div id="admin-dashboard" class="admin-dashboard hidden">
        <div class="admin-header">
          <h2>Admin Dashboard</h2>
          <button id="admin-close" class="admin-close">×</button>
        </div>
        
        <div class="admin-nav">
          <button class="nav-tab active" data-tab="status">Sync Status</button>
          <button class="nav-tab" data-tab="queue">Queue</button>
          <button class="nav-tab" data-tab="conflicts">Conflicts</button>
          <button class="nav-tab" data-tab="settings">Settings</button>
        </div>
        
        <div class="admin-content">
          <div id="tab-status" class="tab-content active">
            <div class="status-grid">
              <div class="status-card">
                <h3>Sync Status</h3>
                <div id="sync-status-info">Loading...</div>
              </div>
              <div class="status-card">
                <h3>Queue Statistics</h3>
                <div id="queue-stats">Loading...</div>
              </div>
              <div class="status-card">
                <h3>Online Status</h3>
                <div id="online-status">Checking...</div>
              </div>
            </div>
            <div class="actions">
              <button id="force-sync" class="btn btn-primary">Force Sync</button>
              <button id="toggle-online" class="btn btn-secondary">Toggle Online Status</button>
            </div>
          </div>
          
          <div id="tab-queue" class="tab-content">
            <div class="queue-controls">
              <input type="number" id="queue-limit" value="50" min="1" max="500">
              <select id="queue-status" class="select">
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="completed">Completed</option>
              </select>
              <button id="refresh-queue" class="btn btn-secondary">Refresh</button>
              <button id="clear-old" class="btn btn-warning">Clear Old (7 days)</button>
            </div>
            <div id="queue-list" class="list-container">Loading queue...</div>
          </div>
          
          <div id="tab-conflicts" class="tab-content">
            <div class="conflict-controls">
              <input type="number" id="conflict-limit" value="50" min="1" max="500">
              <button id="refresh-conflicts" class="btn btn-secondary">Refresh</button>
            </div>
            <div id="conflict-list" class="list-container">Loading conflicts...</div>
          </div>
          
          <div id="tab-settings" class="tab-content">
            <div class="settings-section">
              <h3>Credentials</h3>
              <div class="credential-form">
                <input type="text" id="api-token" placeholder="API Token">
                <input type="password" id="api-secret" placeholder="API Secret">
                <button id="save-credentials" class="btn btn-primary">Save</button>
                <button id="clear-credentials" class="btn btn-warning">Clear</button>
              </div>
            </div>
            <div class="settings-section">
              <h3>Maintenance</h3>
              <button id="clear-old-requests" class="btn btn-warning">Clear Old Requests</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Setup event listeners for the admin panel
   */
  setupEventListeners() {
    // Toggle admin panel
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        this.togglePanel();
      }
    });

    // Close button
    const closeBtn = document.getElementById('admin-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Sync status actions
    const forceSyncBtn = document.getElementById('force-sync');
    if (forceSyncBtn) {
      forceSyncBtn.addEventListener('click', () => this.forceSync());
    }

    const toggleOnlineBtn = document.getElementById('toggle-online');
    if (toggleOnlineBtn) {
      toggleOnlineBtn.addEventListener('click', () => this.toggleOnlineStatus());
    }

    // Queue actions
    const refreshQueueBtn = document.getElementById('refresh-queue');
    if (refreshQueueBtn) {
      refreshQueueBtn.addEventListener('click', () => this.refreshQueue());
    }

    const clearOldBtn = document.getElementById('clear-old');
    if (clearOldBtn) {
      clearOldBtn.addEventListener('click', () => this.clearOldRequests(7));
    }

    // Conflict actions
    const refreshConflictsBtn = document.getElementById('refresh-conflicts');
    if (refreshConflictsBtn) {
      refreshConflictsBtn.addEventListener('click', () => this.refreshConflicts());
    }

    // Settings actions
    const saveCredentialsBtn = document.getElementById('save-credentials');
    if (saveCredentialsBtn) {
      saveCredentialsBtn.addEventListener('click', () => this.saveCredentials());
    }

    const clearCredentialsBtn = document.getElementById('clear-credentials');
    if (clearCredentialsBtn) {
      clearCredentialsBtn.addEventListener('click', () => this.clearCredentials());
    }

    const clearOldRequestsBtn = document.getElementById('clear-old-requests');
    if (clearOldRequestsBtn) {
      clearOldRequestsBtn.addEventListener('click', () => this.clearOldRequests(7));
    }

    // Listen for sync state changes
    window.electronAPI.on('sync-state-changed', (state) => {
      this.updateSyncStatus(state);
    });
  }

  /**
   * Switch between admin panel tabs
   * @param {string} tabName - Name of the tab to switch to
   */
  switchTab(tabName) {
    // Update navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`tab-${tabName}`).classList.add('active');

    this.currentTab = tabName;

    // Load data for the active tab
    switch (tabName) {
      case 'status':
        this.updateStatus();
        break;
      case 'queue':
        this.refreshQueue();
        break;
      case 'conflicts':
        this.refreshConflicts();
        break;
    }
  }

  /**
   * Toggle admin panel visibility
   */
  togglePanel() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show the admin panel
   */
  show() {
    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard) {
      dashboard.classList.remove('hidden');
      this.isVisible = true;
      this.updateStatus(); // Load initial data
    }
  }

  /**
   * Hide the admin panel
   */
  hide() {
    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard) {
      dashboard.classList.add('hidden');
      this.isVisible = false;
    }
  }

  /**
   * Update status information
   */
  async updateStatus() {
    try {
      // Update sync status
      const syncStatus = await window.offlineInterceptor.getSyncStatus();
      this.updateSyncStatus(syncStatus);

      // Update queue statistics
      const queueStats = await window.offlineInterceptor.getQueueStatus();
      this.updateQueueStats(queueStats);

      // Update online status
      await this.updateOnlineStatus();

    } catch (error) {
      console.error('Failed to update status:', error);
      this.showError('status', 'Failed to load status information');
    }
  }

  /**
   * Update sync status display
   * @param {Object} syncStatus - Sync status information
   */
  updateSyncStatus(syncStatus) {
    const statusElement = document.getElementById('sync-status-info');
    if (!statusElement) return;

    const status = syncStatus.state || 'unknown';
    const lastSync = syncStatus.lastSyncTime
      ? new Date(syncStatus.lastSyncTime).toLocaleString()
      : 'Never';

    const stats = syncStatus.stats || {};
    const successCount = stats.successCount || 0;
    const failureCount = stats.failureCount || 0;
    const conflictCount = stats.conflictCount || 0;
    const lastDurationMs = stats.lastSyncDuration || 0;

    statusElement.innerHTML = `
      <div class="status-item">
        <strong>State:</strong>
        <span class="status-${status}">${status.toUpperCase()}</span>
      </div>
      <div class="status-item">
        <strong>Last Sync:</strong> ${lastSync}
      </div>
      <div class="status-item">
        <strong>Stats:</strong>
        <ul>
          <li>Success: ${successCount}</li>
          <li>Failed: ${failureCount}</li>
          <li>Conflicts: ${conflictCount}</li>
          <li>Last Duration: ${Math.round(lastDurationMs / 1000)}s</li>
        </ul>
      </div>
    `;
  }

  /**
   * Update queue statistics display
   * @param {Object} queueStats - Queue statistics
   */
  updateQueueStats(queueStats) {
    const statsElement = document.getElementById('queue-stats');
    if (!statsElement) return;

    statsElement.innerHTML = `
      <ul>
        <li><strong>Pending:</strong> ${queueStats.pending || 0}</li>
        <li><strong>Completed:</strong> ${queueStats.completed || 0}</li>
        <li><strong>Failed:</strong> ${queueStats.failed || 0}</li>
        <li><strong>Total:</strong> ${queueStats.total || 0}</li>
      </ul>
    `;
  }

  /**
   * Update online status display
   */
  async updateOnlineStatus() {
    const onlineElement = document.getElementById('online-status');
    if (!onlineElement) return;

    const browserOnline = navigator.onLine;

    try {
      const interceptorStatus = await window.offlineInterceptor.getOnlineStatus();
      const interceptorOnline = interceptorStatus?.isOnline ?? true;

      onlineElement.innerHTML = `
        <div class="status-item">
          <strong>Network:</strong>
          <span class="status-${browserOnline ? 'online' : 'offline'}">
            ${browserOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
        <div class="status-item">
          <strong>Interceptor:</strong>
          <span class="status-${interceptorOnline ? 'online' : 'offline'}">
            ${interceptorOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      `;
    } catch (error) {
      console.error('Failed to get interceptor online status:', error);
      onlineElement.innerHTML = `
        <div class="status-item">
          <strong>Network:</strong>
          <span class="status-${browserOnline ? 'online' : 'offline'}">
            ${browserOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>
      `;
    }
  }

  /**
   * Refresh queue data
   */
  async refreshQueue() {
    try {
      const limitInput = document.getElementById('queue-limit');
      const limit = parseInt(limitInput?.value || 50);

      const statusSelect = document.getElementById('queue-status');
      const status = statusSelect?.value || null;

      const requests = await window.offlineInterceptor.getQueuedRequests(limit, status);
      this.displayQueueRequests(requests);
    } catch (error) {
      console.error('Failed to refresh queue:', error);
      this.showError('queue', 'Failed to load queue data');
    }
  }

  /**
   * Display queue requests in the UI
   * @param {Array} requests - Queue requests
   */
  displayQueueRequests(requests) {
    const queueElement = document.getElementById('queue-list');
    if (!queueElement) return;

    if (!requests || requests.length === 0) {
      queueElement.innerHTML = '<p>No queued requests found.</p>';
      return;
    }

    const requestHtml = requests
      .map(
        (request) => `
      <div class="request-item">
        <div class="request-header">
          <span class="method method-${request.method}">${request.method}</span>
          <span class="url">${this.truncateUrl(request.url)}</span>
          <span class="status status-${request.status}">${request.status}</span>
        </div>
        <div class="request-details">
          <div class="detail-row">
            <strong>ID:</strong> ${request.id}
          </div>
          <div class="detail-row">
            <strong>Created:</strong> ${new Date(request.created_at).toLocaleString()}
          </div>
          <div class="detail-row">
            <strong>Retries:</strong> ${request.retry_count}
          </div>
          ${
            request.next_retry_at
              ? `<div class="detail-row"><strong>Next Retry:</strong> ${new Date(request.next_retry_at).toLocaleString()}</div>`
              : ''
          }
          ${request.error_message ? `<div class="error">Error: ${request.error_message}</div>` : ''}
        </div>
        <div class="request-actions">
          <button onclick="adminDashboard.retryRequest('${request.id}')" 
                  class="btn btn-sm btn-primary">Retry</button>
          <button onclick="adminDashboard.removeRequest('${request.id}')" 
                  class="btn btn-sm btn-danger">Remove</button>
        </div>
      </div>
    `
      )
      .join('');

    queueElement.innerHTML = requestHtml;
  }

  /**
   * Remove a queued request
   * @param {string} requestId - Request ID to remove
   */
  async removeRequest(requestId) {
    try {
      await window.offlineInterceptor.removeRequest(requestId);
      await this.refreshQueue();
      this.showSuccess('Request removed successfully');
    } catch (error) {
      console.error('Failed to remove request:', error);
      this.showError('queue', 'Failed to remove request');
    }
  }

  /**
   * Retry a queued request immediately
   * @param {string} requestId - Request ID to retry
   */
  async retryRequest(requestId) {
    try {
      const result = await window.offlineInterceptor.retryRequest(requestId, {
        resetRetryCount: true,
      });

      if (!result?.success) {
        throw new Error(result?.error || 'Retry failed');
      }

      await this.refreshQueue();
      this.showSuccess('Request re-queued for retry');
    } catch (error) {
      console.error('Failed to retry request:', error);
      this.showError('queue', 'Failed to retry request');
    }
  }

  /**
   * Refresh conflicts data
   */
  async refreshConflicts() {
    try {
      const limitInput = document.getElementById('conflict-limit');
      const limit = parseInt(limitInput?.value || 50);
      
      const conflicts = await window.offlineInterceptor.getPendingConflicts(limit);
      this.displayConflicts(conflicts);
    } catch (error) {
      console.error('Failed to refresh conflicts:', error);
      this.showError('conflicts', 'Failed to load conflicts data');
    }
  }

  /**
   * Display conflicts in the UI
   * @param {Array} conflicts - Conflict list
   */
  displayConflicts(conflicts) {
    const conflictsElement = document.getElementById('conflict-list');
    if (!conflictsElement) return;

    if (!conflicts || conflicts.length === 0) {
      conflictsElement.innerHTML = '<p>No conflicts found.</p>';
      return;
    }

    const conflictHtml = conflicts.map(conflict => `
      <div class="conflict-item">
        <div class="conflict-header">
          <span class="resource-type">${conflict.resource_type}</span>
          <span class="resource-id">${conflict.resource_id}</span>
          <span class="conflict-type">${conflict.conflict_type}</span>
        </div>
        <div class="conflict-details">
          <div class="detail-row">
            <strong>Created:</strong> ${new Date(conflict.created_at).toLocaleString()}
          </div>
          <div class="detail-row">
            <strong>Status:</strong> ${conflict.resolution_status}
          </div>
          ${
            conflict.server_data
              ? `
            <div class="data-comparison">
              <strong>Server Data:</strong>
              <pre>${JSON.stringify(conflict.server_data, null, 2)}</pre>
            </div>
          `
              : ''
          }
          ${
            conflict.local_data
              ? `
            <div class="data-comparison">
              <strong>Local Data:</strong>
              <pre>${JSON.stringify(conflict.local_data, null, 2)}</pre>
            </div>
          `
              : ''
          }
        </div>
        <div class="conflict-actions">
          <button onclick="adminDashboard.resolveConflict('${conflict.id}', 'local_wins')" 
                  class="btn btn-sm btn-success">Local Wins</button>
          <button onclick="adminDashboard.resolveConflict('${conflict.id}', 'server_wins')" 
                  class="btn btn-sm btn-info">Server Wins</button>
          <button onclick="adminDashboard.resolveConflict('${conflict.id}', 'skip')" 
                  class="btn btn-sm btn-warning">Skip</button>
        </div>
      </div>
    `).join('');

    conflictsElement.innerHTML = conflictHtml;
  }

  /**
   * Resolve a conflict
   * @param {string} conflictId - Conflict ID
   * @param {string} resolution - Resolution type
   */
  async resolveConflict(conflictId, resolution) {
    try {
      await window.offlineInterceptor.resolveConflict(conflictId, resolution);
      await this.refreshConflicts();
      this.showSuccess('Conflict resolved successfully');
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
      this.showError('conflicts', 'Failed to resolve conflict');
    }
  }

  /**
   * Force sync
   */
  async forceSync() {
    try {
      await window.offlineInterceptor.forceSync();
      this.showSuccess('Sync triggered successfully');
      await this.updateStatus();
    } catch (error) {
      console.error('Failed to force sync:', error);
      this.showError('status', 'Failed to trigger sync');
    }
  }

  /**
   * Toggle online status
   */
  async toggleOnlineStatus() {
    try {
      const current = await window.offlineInterceptor.getOnlineStatus();
      const isInterceptorOnline = current?.isOnline ?? true;
      const next = !isInterceptorOnline;

      await window.offlineInterceptor.setOnlineStatus(next);
      this.showSuccess(`Interceptor online status set to ${next ? 'online' : 'offline'}`);
      await this.updateOnlineStatus();
    } catch (error) {
      console.error('Failed to toggle online status:', error);
      this.showError('status', 'Failed to change online status');
    }
  }

  /**
   * Clear old requests
   */
  async clearOldRequests(days = 7) {
    try {
      await window.offlineInterceptor.clearOldRequests(days);
      this.showSuccess(`Cleared requests older than ${days} days`);

      // Refresh current tab
      switch (this.currentTab) {
        case 'queue':
          await this.refreshQueue();
          break;
        case 'conflicts':
          await this.refreshConflicts();
          break;
        default:
          await this.updateStatus();
      }
    } catch (error) {
      console.error('Failed to clear old requests:', error);
      this.showError(this.currentTab, 'Failed to clear old requests');
    }
  }

  /**
   * Save credentials
   */
  async saveCredentials() {
    try {
      const tokenInput = document.getElementById('api-token');
      const secretInput = document.getElementById('api-secret');
      
      const token = tokenInput?.value || '';
      const secret = secretInput?.value || '';

      if (!token || !secret) {
        this.showError('settings', 'Please provide both token and secret');
        return;
      }

      await window.offlineInterceptor.setCredentials(token, secret);
      this.showSuccess('Credentials saved successfully');
      
      // Clear inputs for security
      if (tokenInput) tokenInput.value = '';
      if (secretInput) secretInput.value = '';
    } catch (error) {
      console.error('Failed to save credentials:', error);
      this.showError('settings', 'Failed to save credentials');
    }
  }

  /**
   * Clear credentials
   */
  async clearCredentials() {
    try {
      await window.offlineInterceptor.clearCredentials();
      this.showSuccess('Credentials cleared successfully');
    } catch (error) {
      console.error('Failed to clear credentials:', error);
      this.showError('settings', 'Failed to clear credentials');
    }
  }

  /**
   * Start auto-refresh for active data
   */
  startAutoRefresh() {
    this.refreshInterval = setInterval(() => {
      if (this.isVisible) {
        switch (this.currentTab) {
          case 'status':
            this.updateStatus().catch((error) => console.error('Auto-refresh status failed:', error));
            break;
          case 'queue':
            this.refreshQueue().catch((error) => console.error('Auto-refresh queue failed:', error));
            break;
          case 'conflicts':
            this.refreshConflicts().catch((error) =>
              console.error('Auto-refresh conflicts failed:', error)
            );
            break;
        }
      }
    }, 10000); // Refresh every 10 seconds
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Show error message
   * @param {string} context - Context where error occurred
   * @param {string} message - Error message
   */
  showError(context, message) {
    console.error(`Admin Dashboard Error (${context}):`, message);
    this.showNotification(message, 'error');
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `admin-notification admin-notification-${type}`;
    notification.textContent = message;

    // Add to admin dashboard
    const dashboard = document.getElementById('admin-dashboard');
    if (dashboard) {
      dashboard.appendChild(notification);

      // Remove after 3 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 3000);
    }
  }

  /**
   * Truncate URL for display
   * @param {string} url - URL to truncate
   * @param {number} maxLength - Maximum length
   * @returns {string} Truncated URL
   */
  truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }

  /**
   * Cleanup when admin dashboard is no longer needed
   */
  destroy() {
    this.stopAutoRefresh();
    
    // Remove event listeners
    document.removeEventListener('keydown', this.keydownHandler);
  }
}

// Initialize admin dashboard when DOM is ready
let adminDashboard;

document.addEventListener('DOMContentLoaded', () => {
  adminDashboard = new AdminDashboard();
  
  // Make it globally accessible for debugging
  window.adminDashboard = adminDashboard;
});

// Export for use in other modules
export default AdminDashboard;