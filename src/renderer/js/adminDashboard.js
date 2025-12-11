/**
 * Admin Dashboard
 * 
 * Vue-like component for admin dashboard functionality
 * Displays sync status, queue, conflicts, and statistics
 */

export class AdminDashboard {
  constructor(containerId, dbManager, syncEngine, offlineInterceptor) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.dbManager = dbManager;
    this.syncEngine = syncEngine;
    this.offlineInterceptor = offlineInterceptor;
    this.isVisible = false;
    this.updateInterval = null;
    this.currentView = 'dashboard';
  }

  initialize() {
    if (!this.container) {
      console.error(`Container #${this.containerId} not found`);
      return;
    }

    this.renderLayout();
    this.attachEventListeners();
    this.startAutoRefresh();
  }

  renderLayout() {
    this.container.innerHTML = `
      <div class="admin-dashboard">
        <div class="dashboard-header">
          <h1>POSAwesome Admin Dashboard</h1>
          <div class="header-controls">
            <button class="btn btn-primary" data-action="toggle-sync">🔄 Start Sync</button>
            <button class="btn btn-secondary" data-action="toggle-visible">👁️ Toggle</button>
          </div>
        </div>

        <div class="dashboard-tabs">
          <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
          <button class="tab-btn" data-tab="queue">Queue (${this.offlineInterceptor.getQueueStatus().pending})</button>
          <button class="tab-btn" data-tab="conflicts">Conflicts</button>
          <button class="tab-btn" data-tab="logs">Logs</button>
        </div>

        <div class="dashboard-content">
          <div class="tab-content active" data-tab="dashboard">
            ${this.renderDashboardTab()}
          </div>
          <div class="tab-content" data-tab="queue">
            ${this.renderQueueTab()}
          </div>
          <div class="tab-content" data-tab="conflicts">
            ${this.renderConflictsTab()}
          </div>
          <div class="tab-content" data-tab="logs">
            ${this.renderLogsTab()}
          </div>
        </div>
      </div>

      <style>
        .admin-dashboard {
          position: fixed;
          bottom: 0;
          right: 0;
          width: 500px;
          max-height: 600px;
          background: #fff;
          border-left: 1px solid #e0e0e0;
          border-top: 1px solid #e0e0e0;
          border-radius: 8px 8px 0 0;
          box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 12px;
          z-index: 10000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .admin-dashboard.hidden {
          display: none;
        }

        .dashboard-header {
          padding: 12px 16px;
          background: #f5f5f5;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .dashboard-header h1 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }

        .header-controls {
          display: flex;
          gap: 8px;
        }

        .btn {
          padding: 6px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          font-size: 11px;
          transition: all 0.2s;
        }

        .btn:hover {
          background: #f0f0f0;
        }

        .btn-primary {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .btn-primary:hover {
          background: #0056b3;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
          border-color: #6c757d;
        }

        .btn-secondary:hover {
          background: #545b62;
        }

        .dashboard-tabs {
          display: flex;
          border-bottom: 1px solid #e0e0e0;
          background: #fafafa;
        }

        .tab-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
          border-bottom: 2px solid transparent;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: #f0f0f0;
        }

        .tab-btn.active {
          border-bottom-color: #007bff;
          color: #007bff;
        }

        .dashboard-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .tab-content {
          display: none;
        }

        .tab-content.active {
          display: block;
        }

        .stat-card {
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 12px;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 11px;
          color: #666;
          text-transform: uppercase;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 700;
          color: #333;
        }

        .stat-subtext {
          font-size: 10px;
          color: #999;
          margin-top: 4px;
        }

        .queue-item {
          background: #f5f5f5;
          border-left: 3px solid #007bff;
          padding: 8px;
          margin-bottom: 6px;
          border-radius: 2px;
        }

        .queue-item.failed {
          border-left-color: #dc3545;
          background: #fff5f5;
        }

        .queue-item.completed {
          border-left-color: #28a745;
          background: #f5fff5;
        }

        .queue-id {
          font-weight: 600;
          font-size: 11px;
          color: #333;
        }

        .queue-status {
          display: inline-block;
          background: #ddd;
          color: #666;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          margin-left: 8px;
        }

        .queue-status.pending {
          background: #fff3cd;
          color: #856404;
        }

        .queue-status.completed {
          background: #d4edda;
          color: #155724;
        }

        .queue-status.failed {
          background: #f8d7da;
          color: #721c24;
        }

        .online-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #28a745;
          margin-right: 6px;
        }

        .online-indicator.offline {
          background: #dc3545;
        }

        .conflict-item {
          background: #fff5f5;
          border-left: 3px solid #dc3545;
          padding: 8px;
          margin-bottom: 6px;
          border-radius: 2px;
        }

        .conflict-id {
          font-weight: 600;
          font-size: 11px;
          color: #333;
        }

        .conflict-action {
          margin-top: 6px;
          display: flex;
          gap: 4px;
        }

        .conflict-action button {
          padding: 4px 8px;
          font-size: 10px;
          border: 1px solid #ddd;
          background: #fff;
          cursor: pointer;
          border-radius: 2px;
        }

        .log-entry {
          padding: 8px;
          border-bottom: 1px solid #e0e0e0;
          font-family: monospace;
          font-size: 10px;
        }

        .log-entry.error {
          color: #dc3545;
          background: #fff5f5;
        }

        .log-entry.warning {
          color: #ff9800;
          background: #fff9f5;
        }

        .log-entry.success {
          color: #28a745;
        }

        .spinner {
          display: inline-block;
          width: 12px;
          height: 12px;
          border: 2px solid #f3f3f3;
          border-top: 2px solid #007bff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .admin-dashboard {
            width: 100%;
            max-height: 300px;
          }
        }
      </style>
    `;
  }

  renderDashboardTab() {
    const syncStatus = this.syncEngine.getSyncStatus();
    const stats = this.syncEngine.getSyncStats();
    const queueStatus = this.offlineInterceptor.getQueueStatus();

    return `
      <div class="stat-card">
        <div class="stat-label">Network Status</div>
        <div class="stat-value">
          <span class="online-indicator ${queueStatus.isOnline ? '' : 'offline'}"></span>
          ${queueStatus.isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Sync Status</div>
        <div class="stat-value">
          ${syncStatus.isSyncing ? '<span class="spinner"></span>' : '✓'} ${syncStatus.isSyncing ? 'Syncing...' : 'Ready'}
        </div>
        <div class="stat-subtext">Last sync: ${syncStatus.metadata[0]?.lastSync || 'Never'}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Data Statistics</div>
        <div class="stat-subtext">
          📄 Invoices: ${stats.invoices}<br>
          👥 Customers: ${stats.customers}<br>
          📤 Queued: ${stats.queuedRequests}<br>
          ⚠️ Conflicts: ${stats.unresolvedConflicts}
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Queue Summary</div>
        <div class="stat-subtext">
          ⏳ Pending: ${queueStatus.pending}<br>
          🔄 Processing: ${queueStatus.processing}<br>
          ✓ Completed: ${queueStatus.completed}<br>
          ✗ Failed: ${queueStatus.failed}
        </div>
      </div>
    `;
  }

  renderQueueTab() {
    const pending = this.offlineInterceptor.getPendingRequests(10);

    if (pending.length === 0) {
      return '<div class="stat-card">Queue is empty ✓</div>';
    }

    return pending.map(req => `
      <div class="queue-item ${req.status}">
        <div class="queue-id">
          ${req.id}
          <span class="queue-status ${req.status}">${req.status}</span>
        </div>
        <div class="queue-status" style="display:block; margin-top:4px;">
          ${req.entity_type}/${req.entity_id} • ${req.operation}
          ${req.retry_count > 0 ? `<br>Retries: ${req.retry_count}/${req.max_retries}` : ''}
        </div>
      </div>
    `).join('');
  }

  renderConflictsTab() {
    const conflicts = this.dbManager.createRepositories().conflicts.findPending({ limit: 10 });

    if (conflicts.length === 0) {
      return '<div class="stat-card">No conflicts ✓</div>';
    }

    return conflicts.map(c => `
      <div class="conflict-item">
        <div class="conflict-id">${c.id}</div>
        <div style="margin-top:4px; font-size:10px;">
          ${c.entity_type}/${c.entity_id}<br>
          Type: ${c.conflict_type}
        </div>
        <div class="conflict-action">
          <button data-action="resolve-conflict" data-conflict-id="${c.id}" data-strategy="remote-wins">
            Accept Remote
          </button>
          <button data-action="resolve-conflict" data-conflict-id="${c.id}" data-strategy="local-wins">
            Keep Local
          </button>
        </div>
      </div>
    `).join('');
  }

  renderLogsTab() {
    const syncStatus = this.syncEngine.getSyncStatus();
    return `
      <div class="log-entry success">✓ Dashboard initialized</div>
      <div class="log-entry ${syncStatus.lastError ? 'error' : 'success'}">
        ${syncStatus.lastError ? `✗ ${syncStatus.lastError.message}` : '✓ No sync errors'}
      </div>
      <div class="log-entry">📊 Stats updated: ${new Date().toLocaleTimeString()}</div>
    `;
  }

  attachEventListeners() {
    this.container.addEventListener('click', (e) => {
      const tabBtn = e.target.closest('.tab-btn');
      if (tabBtn) {
        this.switchTab(tabBtn.dataset.tab);
      }

      const btn = e.target.closest('[data-action]');
      if (btn) {
        const action = btn.dataset.action;
        if (action === 'toggle-sync') {
          this.handleStartSync();
        } else if (action === 'toggle-visible') {
          this.toggleVisibility();
        } else if (action === 'resolve-conflict') {
          this.resolveConflict(btn.dataset.conflictId, btn.dataset.strategy);
        }
      }
    });
  }

  switchTab(tabName) {
    const tabs = this.container.querySelectorAll('.tab-btn');
    const contents = this.container.querySelectorAll('.tab-content');

    tabs.forEach(t => t.classList.remove('active'));
    contents.forEach(c => c.classList.remove('active'));

    this.container
      .querySelector(`[data-tab="${tabName}"].tab-btn`)
      ?.classList.add('active');
    this.container
      .querySelector(`[data-tab="${tabName}"].tab-content`)
      ?.classList.add('active');

    this.currentView = tabName;
  }

  async handleStartSync() {
    const btn = this.container.querySelector('[data-action="toggle-sync"]');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = '🔄 Syncing...';

    try {
      const result = await this.syncEngine.startSyncCycle();
      console.log('Sync completed:', result);
      this.refresh();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      btn.disabled = false;
      btn.textContent = '🔄 Start Sync';
    }
  }

  toggleVisibility() {
    this.container.classList.toggle('hidden');
    this.isVisible = !this.isVisible;
  }

  resolveConflict(conflictId, strategy) {
    try {
      this.syncEngine.resolveConflict(conflictId, strategy);
      this.refresh();
      console.log(`Conflict ${conflictId} resolved with ${strategy}`);
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    }
  }

  startAutoRefresh() {
    this.updateInterval = setInterval(() => {
      if (this.isVisible && this.container.offsetParent !== null) {
        this.refresh();
      }
    }, 5000); // Refresh every 5 seconds
  }

  refresh() {
    const activeTab = this.container.querySelector('.tab-content.active');
    if (!activeTab) return;

    const tabName = activeTab.dataset.tab;
    let content;

    if (tabName === 'dashboard') {
      content = this.renderDashboardTab();
    } else if (tabName === 'queue') {
      content = this.renderQueueTab();
    } else if (tabName === 'conflicts') {
      content = this.renderConflictsTab();
    } else if (tabName === 'logs') {
      content = this.renderLogsTab();
    }

    if (content) {
      activeTab.innerHTML = content;
    }
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}

export default AdminDashboard;
