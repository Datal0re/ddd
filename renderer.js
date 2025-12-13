const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  getAppPath: pathName => ipcRenderer.invoke('get-app-path', pathName),
  selectFile: () => ipcRenderer.invoke('select-file'),
  processUpload: filePath => ipcRenderer.invoke('process-upload', filePath),
  getConversations: exportName => ipcRenderer.invoke('get-conversations', exportName),
  getConversation: (exportName, conversationId) =>
    ipcRenderer.invoke('get-conversation', exportName, conversationId),
  deleteExport: exportName => ipcRenderer.invoke('delete-export', exportName),
  getAllExports: () => ipcRenderer.invoke('get-all-exports'),

  // AI Integration methods (updated for export-based architecture)
  aiAnalyzeConversation: (exportName, conversationId, analysisType) =>
    ipcRenderer.invoke(
      'ai-analyze-conversation',
      exportName,
      conversationId,
      analysisType
    ),
  aiSearchConversations: (exportName, query, searchType) =>
    ipcRenderer.invoke('ai-search-conversations', exportName, query, searchType),
  aiSummarizeExport: (exportName, summaryType) =>
    ipcRenderer.invoke('ai-summarize-export', exportName, summaryType),

  // Migration management methods
  getMigratableSessions: () => ipcRenderer.invoke('get-migratable-sessions'),
  getMigrationStats: () => ipcRenderer.invoke('get-migration-stats'),
  migrateSession: (sessionId, exportName) =>
    ipcRenderer.invoke('migrate-session', sessionId, exportName),
  getMigrationProgress: migrationId =>
    ipcRenderer.invoke('get-migration-progress', migrationId),

  // Backup management methods
  getBackups: exportName => ipcRenderer.invoke('get-backups', exportName),
  createBackup: (exportName, options = {}) =>
    ipcRenderer.invoke('create-backup', exportName, options),
  restoreBackup: (exportName, backupId) =>
    ipcRenderer.invoke('restore-backup', exportName, backupId),
  deleteBackup: (exportName, backupId) =>
    ipcRenderer.invoke('delete-backup', exportName, backupId),
  getBackupStats: () => ipcRenderer.invoke('get-backup-stats'),
  cleanupBackups: exportName => ipcRenderer.invoke('cleanup-backups', exportName),

  // Progress management methods
  onUploadProgress: callback => {
    ipcRenderer.on('upload-progress', (_, progress) => {
      callback(progress);
    });
  },

  removeUploadProgressListener: () => {
    ipcRenderer.removeAllListeners('upload-progress');
  },

  onUploadCancelled: callback => {
    ipcRenderer.on('upload-cancelled', (_, data) => {
      callback(data);
    });
  },

  removeUploadCancelledListener: () => {
    ipcRenderer.removeAllListeners('upload-cancelled');
  },

  getUploadProgress: () => ipcRenderer.invoke('get-upload-progress'),
  setUploadProgress: progressData =>
    ipcRenderer.invoke('set-upload-progress', progressData),
  cancelUpload: uploadId => ipcRenderer.invoke('cancel-upload', uploadId),
  clearUploadProgress: () => ipcRenderer.invoke('clear-upload-progress'),

  // Navigation helpers
  navigateTo: page => {
    window.location.href = page;
  },

  // DOM manipulation helpers
  loadContent: async (templatePath, data = {}) => {
    try {
      const response = await fetch(templatePath);
      let template = await response.text();

      // Simple template variable replacement
      Object.keys(data).forEach(key => {
        template = template.replace(new RegExp(`{{${key}}}`, 'g'), data[key]);
      });

      return template;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error loading template:', error);
      return '';
    }
  },
});
