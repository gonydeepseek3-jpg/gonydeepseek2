/**
 * Integration Module
 * 
 * Provides unified initialization and orchestration of all services:
 * - Database Manager
 * - Offline Interceptor
 * - Sync Engine
 * - Admin Dashboard
 */

import { DatabaseManager } from './db/database.js';
import { OfflineInterceptor } from './services/offlineInterceptor.js';
import { SyncEngine } from './services/syncEngine.js';
import AdminDashboard from './renderer/js/adminDashboard.js';

export class POSAwesomeIntegration {
  constructor(config = {}) {
    this.config = {
      dbPath: config.dbPath,
      erpnextBaseUrl: config.erpnextBaseUrl || process.env.ERPNEXT_BASE_URL,
      apiToken: config.apiToken || process.env.ERPNEXT_API_TOKEN,
      apiSecret: config.apiSecret || process.env.ERPNEXT_API_SECRET,
      syncInterval: config.syncInterval || parseInt(process.env.SYNC_INTERVAL || '60000'),
      dashboardContainerId: config.dashboardContainerId || 'admin-panel',
      ...config,
    };

    this.dbManager = null;
    this.offlineInterceptor = null;
    this.syncEngine = null;
    this.adminDashboard = null;
    this.syncTimer = null;
    this.initialized = false;
  }

  /**
   * Initialize all services
   */
  async initialize() {
    if (this.initialized) {
      console.warn('Integration already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing POSAwesome services...');

      // Initialize Database
      console.log('📦 Initializing database...');
      this.dbManager = new DatabaseManager({
        filePath: this.config.dbPath,
      });
      this.dbManager.open();
      this.dbManager.initialize();
      console.log('✓ Database initialized');

      // Initialize Offline Interceptor
      console.log('📡 Initializing offline interceptor...');
      this.offlineInterceptor = new OfflineInterceptor(this.dbManager);
      this.offlineInterceptor.initialize();
      console.log('✓ Offline interceptor ready');

      // Initialize Sync Engine
      console.log('🔄 Initializing sync engine...');
      this.syncEngine = new SyncEngine(this.dbManager, {
        erpnextBaseUrl: this.config.erpnextBaseUrl,
        apiToken: this.config.apiToken,
        apiSecret: this.config.apiSecret,
        syncInterval: this.config.syncInterval,
      });
      this.syncEngine.initialize();
      console.log('✓ Sync engine ready');

      // Setup sync callbacks
      this.setupSyncCallbacks();

      // Initialize Admin Dashboard (if in browser environment)
      if (typeof document !== 'undefined') {
        console.log('🎛️ Initializing admin dashboard...');
        this.adminDashboard = new AdminDashboard(
          this.config.dashboardContainerId,
          this.dbManager,
          this.syncEngine,
          this.offlineInterceptor
        );
        this.adminDashboard.initialize();
        console.log('✓ Admin dashboard ready');
      }

      // Start periodic sync
      this.startPeriodicSync();

      this.initialized = true;
      console.log('✅ All services initialized successfully');

      return {
        success: true,
        services: {
          database: this.dbManager,
          offlineInterceptor: this.offlineInterceptor,
          syncEngine: this.syncEngine,
          adminDashboard: this.adminDashboard,
        },
      };
    } catch (error) {
      console.error('❌ Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup sync event callbacks
   */
  setupSyncCallbacks() {
    // Trigger sync when online
    this.offlineInterceptor.onPendingSync((status) => {
      if (status.pending > 0) {
        console.log(`📤 Processing ${status.pending} pending requests...`);
        this.syncEngine.startSyncCycle().catch(err => {
          console.error('Sync cycle failed:', err);
        });
      }
    });

    // Update UI on sync complete
    this.syncEngine.onSyncComplete((result) => {
      if (result.success) {
        console.log('✓ Sync complete:', result.results);
      } else {
        console.error('✗ Sync failed:', result.error);
      }
    });
  }

  /**
   * Start automatic sync timer
   */
  startPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (navigator.onLine) {
        console.log('🔄 Starting scheduled sync cycle...');
        try {
          await this.syncEngine.startSyncCycle();
        } catch (error) {
          console.error('Scheduled sync failed:', error);
        }
      }
    }, this.config.syncInterval);

    console.log(`⏱️ Sync scheduled every ${this.config.syncInterval}ms`);
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      database: {
        connected: this.dbManager?.db !== null,
        stats: this.dbManager?.getStats(),
      },
      sync: this.syncEngine?.getSyncStatus(),
      queue: this.offlineInterceptor?.getQueueStatus(),
      network: {
        online: navigator.onLine,
      },
    };
  }

  /**
   * Manual sync trigger
   */
  async triggerSync() {
    console.log('📤 Manual sync triggered');
    return this.syncEngine.startSyncCycle();
  }

  /**
   * Force full resync
   */
  async forceFullSync() {
    console.log('🔄 Force full sync triggered');
    return this.syncEngine.forceSyncAll();
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return this.offlineInterceptor?.getQueueStatus();
  }

  /**
   * Get sync statistics
   */
  getSyncStats() {
    return this.syncEngine?.getSyncStats();
  }

  /**
   * Export data for debugging
   */
  exportDebugInfo() {
    return {
      timestamp: new Date().toISOString(),
      status: this.getStatus(),
      queueExport: this.offlineInterceptor?.exportQueueJson(),
      databaseStats: this.dbManager?.getStats(),
    };
  }

  /**
   * Shutdown all services
   */
  shutdown() {
    console.log('🛑 Shutting down services...');

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    if (this.adminDashboard) {
      this.adminDashboard.destroy();
    }

    if (this.dbManager) {
      this.dbManager.close();
    }

    this.initialized = false;
    console.log('✓ All services shut down');
  }

  /**
   * Get database repositories for direct access
   */
  getRepositories() {
    return this.dbManager?.createRepositories();
  }
}

// Export for use in both main and renderer processes
export default POSAwesomeIntegration;
