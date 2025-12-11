/**
 * Offline Interceptor Service - Renderer Process Example
 * This file demonstrates how to use the offline interceptor service
 * in the POSAwesome frontend application
 */

class OfflineInterceptorManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.statusElement = null;
    this.queueElement = null;
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    this.isOnline = true;
    window.offlineInterceptor.setOnlineStatus(true);
    this.updateStatusUI('online');
    this.processQueueIfNeeded();
  }

  handleOffline() {
    this.isOnline = false;
    window.offlineInterceptor.setOnlineStatus(false);
    this.updateStatusUI('offline');
  }

  async setCredentials(token, secret) {
    try {
      const result = await window.offlineInterceptor.setCredentials(token, secret);
      if (result.success) {
        console.log('Credentials stored successfully');
        return true;
      } else {
        console.error('Failed to store credentials:', result.error);
        return false;
      }
    } catch (error) {
      console.error('Error storing credentials:', error);
      return false;
    }
  }

  async getQueueStatus() {
    try {
      const stats = await window.offlineInterceptor.getQueueStatus();
      return stats;
    } catch (error) {
      console.error('Error getting queue status:', error);
      return { pending: 0, completed: 0, failed: 0, total: 0 };
    }
  }

  async getQueuedRequests(limit = 50) {
    try {
      const requests = await window.offlineInterceptor.getQueuedRequests(limit);
      return requests;
    } catch (error) {
      console.error('Error getting queued requests:', error);
      return [];
    }
  }

  async removeRequest(id) {
    try {
      const result = await window.offlineInterceptor.removeRequest(id);
      if (result.success) {
        console.log(`Request ${id} removed from queue`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error removing request:', error);
      return false;
    }
  }

  async clearOldRequests(days = 7) {
    try {
      const result = await window.offlineInterceptor.clearOldRequests(days);
      if (result.success) {
        console.log(`Old requests (${days}+ days) cleared`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error clearing old requests:', error);
      return false;
    }
  }

  updateStatusUI(status) {
    if (this.statusElement) {
      this.statusElement.textContent = status === 'online' ? 'Online' : 'Offline';
      this.statusElement.className = `status-${status}`;
    }
  }

  async refreshQueueUI() {
    try {
      const stats = await this.getQueueStatus();
      if (this.queueElement) {
        this.queueElement.innerHTML = `
          <div class="queue-stats">
            <p>Pending: <strong>${stats.pending}</strong></p>
            <p>Completed: <strong>${stats.completed}</strong></p>
            <p>Failed: <strong>${stats.failed}</strong></p>
            <p>Total: <strong>${stats.total}</strong></p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error refreshing queue UI:', error);
    }
  }

  async processQueueIfNeeded() {
    const stats = await this.getQueueStatus();
    if (stats.pending > 0) {
      console.log(`Processing ${stats.pending} pending requests`);
    }
  }

  initializeUI(statusElementId, queueElementId) {
    this.statusElement = document.getElementById(statusElementId);
    this.queueElement = document.getElementById(queueElementId);

    this.updateStatusUI(this.isOnline ? 'online' : 'offline');

    setInterval(() => {
      this.refreshQueueUI();
    }, 5000);
  }
}

// Export for use in the application
window.offlineInterceptorManager = new OfflineInterceptorManager();
