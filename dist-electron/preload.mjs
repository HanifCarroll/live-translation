"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  selectFolder: () => electron.ipcRenderer.invoke("dialog:selectFolder"),
  // File operations
  createTranscriptFiles: (folderPath, sessionName) => electron.ipcRenderer.invoke("files:createTranscripts", folderPath, sessionName),
  appendToTranscript: (filename, text) => electron.ipcRenderer.invoke("files:appendTranscript", filename, text),
  closeTranscriptFiles: () => electron.ipcRenderer.invoke("files:closeTranscripts"),
  // API Keys
  getApiKeys: () => electron.ipcRenderer.invoke("config:getApiKeys"),
  // System Settings
  openSystemSettings: () => electron.ipcRenderer.invoke("system:openSettings"),
  getCurrentDirectory: () => electron.ipcRenderer.invoke("system:getCurrentDirectory"),
  openExternalUrl: (url) => electron.ipcRenderer.invoke("system:openExternalUrl", url)
});
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  }
});
