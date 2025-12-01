const { contextBridge, ipcRenderer } = require("electron");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
  readFile: (filePath) => ipcRenderer.invoke("read-file", filePath),
  writeFile: (filePath, data) =>
    ipcRenderer.invoke("write-file", filePath, data),
  getAppPath: (pathName) => ipcRenderer.invoke("get-app-path", pathName),

  // Navigation helpers
  navigateTo: (page) => {
    window.location.href = page;
  },

  // DOM manipulation helpers
  loadContent: async (templatePath, data = {}) => {
    try {
      const response = await fetch(templatePath);
      let template = await response.text();

      // Simple template variable replacement
      Object.keys(data).forEach((key) => {
        template = template.replace(new RegExp(`{{${key}}}`, "g"), data[key]);
      });

      return template;
    } catch (error) {
      console.error("Error loading template:", error);
      return "";
    }
  },
});
