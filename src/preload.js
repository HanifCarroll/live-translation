// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  // File operations
  createTranscriptFiles: (folderPath) => ipcRenderer.invoke('files:createTranscripts', folderPath),
  appendToTranscript: (filename, text) => ipcRenderer.invoke('files:appendTranscript', filename, text),
  closeTranscriptFiles: () => ipcRenderer.invoke('files:closeTranscripts'),
  
  // API Keys
  getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
  
  // System Settings
  openSystemSettings: () => ipcRenderer.invoke('system:openSettings')
});
