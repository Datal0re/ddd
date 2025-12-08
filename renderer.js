const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  getAppPath: pathName => ipcRenderer.invoke('get-app-path', pathName),
  selectFile: () => ipcRenderer.invoke('select-file'),
  processUpload: filePath => ipcRenderer.invoke('process-upload', filePath),
  getConversations: sessionId => ipcRenderer.invoke('get-conversations', sessionId),
  getConversation: (sessionId, conversationId) =>
    ipcRenderer.invoke('get-conversation', sessionId, conversationId),
  cleanupSessions: () => ipcRenderer.invoke('cleanup-sessions'),
  deleteSession: sessionId => ipcRenderer.invoke('delete-session', sessionId),
  getAllSessions: () => ipcRenderer.invoke('get-all-sessions'),

  // AI Integration methods
  aiAnalyzeConversation: (sessionId, conversationId, analysisType) =>
    ipcRenderer.invoke(
      'ai-analyze-conversation',
      sessionId,
      conversationId,
      analysisType
    ),
  aiSearchConversations: (sessionId, query, searchType) =>
    ipcRenderer.invoke('ai-search-conversations', sessionId, query, searchType),
  aiSummarizeSession: (sessionId, summaryType) =>
    ipcRenderer.invoke('ai-summarize-session', sessionId, summaryType),

  // Backup management methods
  createBackup: sessionId => ipcRenderer.invoke('create-backup', sessionId),
  listBackups: sessionId => ipcRenderer.invoke('list-backups', sessionId),
  restoreBackup: (sessionId, backupFile) =>
    ipcRenderer.invoke('restore-backup', sessionId, backupFile),

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
