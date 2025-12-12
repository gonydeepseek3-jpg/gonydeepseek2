// Example usage of Sync Engine & Conflict Resolution features

// Listen for sync state changes
window.electronAPI.on('sync-state-changed', (data) => {
  console.log('=== Sync State Changed ===');
  console.log('State:', data.state);
  console.log('Last sync:', data.lastSyncTime);
  console.log('Statistics:');
  console.log('  - Success:', data.stats.successCount);
  console.log('  - Failures:', data.stats.failureCount);
  console.log('  - Conflicts:', data.stats.conflictCount);
  console.log('  - Duration:', data.stats.lastSyncDuration, 'ms');
  
  updateSyncUI(data);
});

// Listen for sync progress
window.electronAPI.on('sync-progress', (data) => {
  console.log('=== Sync Progress ===');
  console.log(`Processing: ${data.processed}/${data.total}`);
  console.log(`Success: ${data.successCount}, Failed: ${data.failureCount}, Conflicts: ${data.conflictCount}`);
  
  updateProgressUI(data);
});

// Get current sync status
async function getSyncStatus() {
  try {
    const status = await window.offlineInterceptor.getSyncStatus();
    console.log('=== Current Sync Status ===');
    console.log('State:', status.state);
    console.log('Is Processing:', status.isProcessing);
    console.log('Last Sync:', status.lastSyncTime);
    console.log('Pending Requests:', status.queueStats.pending);
    console.log('Pending Conflicts:', status.pendingConflicts);
    return status;
  } catch (error) {
    console.error('Failed to get sync status:', error);
  }
}

// Force immediate sync
async function forceSync() {
  try {
    console.log('Triggering force sync...');
    await window.offlineInterceptor.forceSync();
    console.log('Force sync triggered successfully');
  } catch (error) {
    console.error('Failed to force sync:', error);
  }
}

// Get pending conflicts
async function getPendingConflicts() {
  try {
    const conflicts = await window.offlineInterceptor.getPendingConflicts(20);
    console.log('=== Pending Conflicts ===');
    console.log(`Found ${conflicts.length} conflicts`);
    
    conflicts.forEach((conflict, index) => {
      console.log(`\nConflict ${index + 1}:`);
      console.log('  ID:', conflict.id);
      console.log('  Resource:', conflict.resource_type, conflict.resource_id);
      console.log('  Type:', conflict.conflict_type);
      console.log('  Local Data:', conflict.local_data);
      console.log('  Server Data:', conflict.server_data);
      console.log('  Server Version:', conflict.server_version);
      console.log('  Created:', conflict.created_at);
    });
    
    return conflicts;
  } catch (error) {
    console.error('Failed to get pending conflicts:', error);
  }
}

// Resolve a conflict
async function resolveConflict(conflictId, resolution) {
  try {
    console.log(`Resolving conflict ${conflictId} with: ${resolution}`);
    const result = await window.offlineInterceptor.resolveConflict(conflictId, resolution);
    
    if (result.success) {
      console.log('Conflict resolved successfully');
    } else {
      console.error('Failed to resolve conflict:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('Error resolving conflict:', error);
  }
}

// UI update functions (implement based on your UI framework)
function updateSyncUI(data) {
  const stateElement = document.getElementById('sync-state');
  const statsElement = document.getElementById('sync-stats');
  
  if (stateElement) {
    stateElement.textContent = data.state;
    stateElement.className = `sync-state sync-state-${data.state}`;
  }
  
  if (statsElement) {
    statsElement.innerHTML = `
      <div>Success: ${data.stats.successCount}</div>
      <div>Failures: ${data.stats.failureCount}</div>
      <div>Conflicts: ${data.stats.conflictCount}</div>
      <div>Last Sync: ${new Date(data.lastSyncTime).toLocaleString()}</div>
    `;
  }
}

function updateProgressUI(data) {
  const progressElement = document.getElementById('sync-progress');
  
  if (progressElement) {
    const percentage = (data.processed / data.total) * 100;
    progressElement.style.width = `${percentage}%`;
    progressElement.textContent = `${data.processed}/${data.total}`;
  }
}

// Example: Display conflicts in a list
async function displayConflictsInUI() {
  const conflicts = await getPendingConflicts();
  const conflictsContainer = document.getElementById('conflicts-list');
  
  if (!conflictsContainer) return;
  
  conflictsContainer.innerHTML = '';
  
  if (conflicts.length === 0) {
    conflictsContainer.innerHTML = '<p>No pending conflicts</p>';
    return;
  }
  
  conflicts.forEach((conflict) => {
    const conflictCard = document.createElement('div');
    conflictCard.className = 'conflict-card';
    conflictCard.innerHTML = `
      <h3>Conflict: ${conflict.resource_type} - ${conflict.resource_id}</h3>
      <p><strong>Type:</strong> ${conflict.conflict_type}</p>
      <p><strong>Created:</strong> ${new Date(conflict.created_at).toLocaleString()}</p>
      
      <div class="conflict-data">
        <div class="local-data">
          <h4>Local Version</h4>
          <pre>${JSON.stringify(conflict.local_data, null, 2)}</pre>
        </div>
        <div class="server-data">
          <h4>Server Version</h4>
          <pre>${JSON.stringify(conflict.server_data, null, 2)}</pre>
        </div>
      </div>
      
      <div class="conflict-actions">
        <button onclick="resolveConflict(${conflict.id}, 'local_wins')">Use Local</button>
        <button onclick="resolveConflict(${conflict.id}, 'server_wins')">Use Server</button>
        <button onclick="resolveConflict(${conflict.id}, 'skip')">Skip</button>
      </div>
    `;
    
    conflictsContainer.appendChild(conflictCard);
  });
}

// Example: Monitor sync status periodically
function startSyncMonitoring(intervalMs = 5000) {
  setInterval(async () => {
    const status = await getSyncStatus();
    
    // Check for pending conflicts and alert user
    if (status && status.pendingConflicts > 0) {
      console.warn(`${status.pendingConflicts} conflicts need resolution!`);
      // Show notification or update UI
      showConflictNotification(status.pendingConflicts);
    }
    
    // Check sync health
    if (status && status.state === 'failed') {
      console.error('Sync is in failed state!');
      showSyncErrorNotification();
    }
  }, intervalMs);
}

function showConflictNotification(count) {
  // Implement notification display
  console.log(`⚠️ ${count} conflict(s) need your attention`);
}

function showSyncErrorNotification() {
  // Implement error notification
  console.error('❌ Sync has failed. Please check your connection.');
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Sync Engine Example initialized');
  
  // Get initial sync status
  getSyncStatus();
  
  // Start monitoring (optional)
  // startSyncMonitoring();
  
  // Attach event handlers to buttons
  const forceSyncBtn = document.getElementById('force-sync-btn');
  if (forceSyncBtn) {
    forceSyncBtn.addEventListener('click', forceSync);
  }
  
  const refreshConflictsBtn = document.getElementById('refresh-conflicts-btn');
  if (refreshConflictsBtn) {
    refreshConflictsBtn.addEventListener('click', displayConflictsInUI);
  }
});

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSyncStatus,
    forceSync,
    getPendingConflicts,
    resolveConflict,
    displayConflictsInUI,
    startSyncMonitoring,
  };
}
