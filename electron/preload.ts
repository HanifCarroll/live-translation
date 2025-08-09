import { ipcRenderer, contextBridge } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  
  // File operations
  createTranscriptFiles: (folderPath: string, sessionName: string) => 
    ipcRenderer.invoke('files:createTranscripts', folderPath, sessionName),
  appendToTranscript: (filename: string, text: string) => 
    ipcRenderer.invoke('files:appendTranscript', filename, text),
  closeTranscriptFiles: () => ipcRenderer.invoke('files:closeTranscripts'),
  
  // API Keys
  getApiKeys: () => ipcRenderer.invoke('config:getApiKeys'),
  
  // System Settings
  openSystemSettings: () => ipcRenderer.invoke('system:openSettings'),
  getCurrentDirectory: () => ipcRenderer.invoke('system:getCurrentDirectory'),
  openExternalUrl: (url: string) => ipcRenderer.invoke('system:openExternalUrl', url)
})

// Keep the original ipcRenderer for development/debugging if needed
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  }
})
