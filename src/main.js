const { app, BrowserWindow, ipcMain, dialog, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config();

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Temporarily disable for testing
    },
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.whenReady().then(() => {
  if (!app.isPackaged) {
    const ses = session.defaultSession;
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = details.responseHeaders || {};
      delete headers['content-security-policy'];
      delete headers['Content-Security-Policy'];
      callback({ responseHeaders: headers });
    });
  }

  createWindow();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// File handles for transcript files
let transcriptFiles = {
  en: null,
  es: null,
  folderPath: null
};

// IPC Handlers

// Handle folder selection dialog
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Output Folder for Transcripts',
    buttonLabel: 'Select Folder'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Handle transcript file creation
ipcMain.handle('files:createTranscripts', async (event, folderPath) => {
  try {
    // Close any existing file streams
    if (transcriptFiles.en) {
      transcriptFiles.en.end();
      transcriptFiles.en = null;
    }
    if (transcriptFiles.es) {
      transcriptFiles.es.end();
      transcriptFiles.es = null;
    }
    
    // Create new file streams (overwrite mode)
    const enPath = path.join(folderPath, 'transcript-en.txt');
    const esPath = path.join(folderPath, 'transcript-es.txt');
    
    transcriptFiles.en = fs.createWriteStream(enPath, { flags: 'w', encoding: 'utf8' });
    transcriptFiles.es = fs.createWriteStream(esPath, { flags: 'w', encoding: 'utf8' });
    transcriptFiles.folderPath = folderPath;
    
    console.log('Created transcript files in:', folderPath);
    return { success: true, folderPath };
  } catch (error) {
    console.error('Error creating transcript files:', error);
    return { success: false, error: error.message };
  }
});

// Handle appending text to transcript files
ipcMain.handle('files:appendTranscript', async (event, filename, text) => {
  try {
    const file = filename === 'en' ? transcriptFiles.en : transcriptFiles.es;
    if (file) {
      file.write(text + '\n');
      return { success: true };
    }
    return { success: false, error: 'File stream not initialized' };
  } catch (error) {
    console.error('Error appending to transcript:', error);
    return { success: false, error: error.message };
  }
});

// Handle closing transcript files
ipcMain.handle('files:closeTranscripts', async () => {
  try {
    if (transcriptFiles.en) {
      transcriptFiles.en.end();
      transcriptFiles.en = null;
    }
    if (transcriptFiles.es) {
      transcriptFiles.es.end();
      transcriptFiles.es = null;
    }
    transcriptFiles.folderPath = null;
    return { success: true };
  } catch (error) {
    console.error('Error closing transcript files:', error);
    return { success: false, error: error.message };
  }
});

// Handle getting API keys
ipcMain.handle('config:getApiKeys', async () => {
  return {
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY
  };
});

// Handle opening system settings
ipcMain.handle('system:openSettings', async () => {
  try {
    if (process.platform === 'darwin') {
      // macOS: Open Privacy & Security > Microphone settings
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
    } else if (process.platform === 'win32') {
      // Windows: Open Settings > Privacy > Microphone
      await shell.openExternal('ms-settings:privacy-microphone');
    } else {
      // Linux: Try to open system settings
      await shell.openExternal('gnome-control-center sound');
    }
    return { success: true };
  } catch (error) {
    console.error('Error opening system settings:', error);
    return { success: false, error: error.message };
  }
});

// Handle getting current working directory
ipcMain.handle('system:getCurrentDirectory', async () => {
  try {
    return { success: true, path: process.cwd() };
  } catch (error) {
    console.error('Error getting current directory:', error);
    return { success: false, error: error.message };
  }
});

// Handle opening external URLs
ipcMain.handle('system:openExternalUrl', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});
