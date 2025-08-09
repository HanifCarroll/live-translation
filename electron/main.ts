import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { config as dotenvConfig } from 'dotenv'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env file
dotenvConfig({ path: path.join(__dirname, '..', '.env') })

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Temporarily disable for testing
    },
  })

  // Open the DevTools in development
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools()
  }

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Disable CSP headers in development for Deepgram API access
  if (!app.isPackaged) {
    const ses = session.defaultSession
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = details.responseHeaders || {}
      delete headers['content-security-policy']
      delete headers['Content-Security-Policy']
      callback({ responseHeaders: headers })
    })
  }

  createWindow()
})

// File handles for transcript files
interface TranscriptFiles {
  en: fs.WriteStream | null
  es: fs.WriteStream | null
  folderPath: string | null
}

let transcriptFiles: TranscriptFiles = {
  en: null,
  es: null,
  folderPath: null
}

// IPC Handlers

// Handle folder selection dialog
ipcMain.handle('dialog:selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Output Folder for Transcripts',
    buttonLabel: 'Select Folder'
  })
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// Handle transcript file creation
ipcMain.handle('files:createTranscripts', async (event, folderPath: string, sessionName: string = 'transcript') => {
  try {
    // Close any existing file streams
    if (transcriptFiles.en) {
      transcriptFiles.en.end()
      transcriptFiles.en = null
    }
    if (transcriptFiles.es) {
      transcriptFiles.es.end()
      transcriptFiles.es = null
    }
    
    // Create new file streams (overwrite mode) with custom session name
    const enPath = path.join(folderPath, `${sessionName}-en.txt`)
    const esPath = path.join(folderPath, `${sessionName}-es.txt`)
    
    transcriptFiles.en = fs.createWriteStream(enPath, { flags: 'w', encoding: 'utf8' })
    transcriptFiles.es = fs.createWriteStream(esPath, { flags: 'w', encoding: 'utf8' })
    transcriptFiles.folderPath = folderPath
    
    console.log('Created transcript files in:', folderPath)
    return { success: true, folderPath }
  } catch (error: any) {
    console.error('Error creating transcript files:', error)
    return { success: false, error: error.message }
  }
})

// Handle appending text to transcript files
ipcMain.handle('files:appendTranscript', async (event, filename: string, text: string) => {
  try {
    const file = filename === 'en' ? transcriptFiles.en : transcriptFiles.es
    if (file) {
      file.write(text + '\n')
      return { success: true }
    }
    return { success: false, error: 'File stream not initialized' }
  } catch (error: any) {
    console.error('Error appending to transcript:', error)
    return { success: false, error: error.message }
  }
})

// Handle closing transcript files
ipcMain.handle('files:closeTranscripts', async () => {
  try {
    if (transcriptFiles.en) {
      transcriptFiles.en.end()
      transcriptFiles.en = null
    }
    if (transcriptFiles.es) {
      transcriptFiles.es.end()
      transcriptFiles.es = null
    }
    transcriptFiles.folderPath = null
    return { success: true }
  } catch (error: any) {
    console.error('Error closing transcript files:', error)
    return { success: false, error: error.message }
  }
})

// Handle getting API keys
ipcMain.handle('config:getApiKeys', async () => {
  console.log('Getting API keys...')
  console.log('DEEPGRAM_API_KEY:', process.env.DEEPGRAM_API_KEY ? 'Found' : 'Missing')
  console.log('GOOGLE_API_KEY:', process.env.GOOGLE_API_KEY ? 'Found' : 'Missing')
  
  return {
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY
  }
})

// Handle opening system settings
ipcMain.handle('system:openSettings', async () => {
  try {
    if (process.platform === 'darwin') {
      // macOS: Open Privacy & Security > Microphone settings
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
    } else if (process.platform === 'win32') {
      // Windows: Open Settings > Privacy > Microphone
      await shell.openExternal('ms-settings:privacy-microphone')
    } else {
      // Linux: Try to open system settings
      await shell.openExternal('gnome-control-center sound')
    }
    return { success: true }
  } catch (error: any) {
    console.error('Error opening system settings:', error)
    return { success: false, error: error.message }
  }
})

// Handle getting current working directory
ipcMain.handle('system:getCurrentDirectory', async () => {
  try {
    return { success: true, path: process.cwd() }
  } catch (error: any) {
    console.error('Error getting current directory:', error)
    return { success: false, error: error.message }
  }
})

// Handle opening external URLs
ipcMain.handle('system:openExternalUrl', async (event, url: string) => {
  try {
    await shell.openExternal(url)
    return { success: true }
  } catch (error: any) {
    console.error('Error opening external URL:', error)
    return { success: false, error: error.message }
  }
})

// Read transcript file
ipcMain.handle('files:readTranscript', async (event, filepath: string) => {
  try {
    const content = fs.readFileSync(filepath, 'utf-8')
    return { success: true, content }
  } catch (error: any) {
    console.error('Error reading transcript file:', error)
    return { success: false, error: error.message }
  }
})

// Delete transcript file
ipcMain.handle('files:deleteTranscript', async (event, filepath: string) => {
  try {
    fs.unlinkSync(filepath)
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting transcript file:', error)
    return { success: false, error: error.message }
  }
})

// Settings management
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json')

interface AppSettings {
  apiKeys: {
    deepgram: string
    google: string
  }
  defaults: {
    translationDirection: 'en-es' | 'es-en'
    outputFolder: string
    micDeviceId: string
    systemDeviceId: string
    sessionNamePattern: string
  }
  ui: {
    theme: 'light' | 'dark' | 'system'
    translationDisplayCount: number
  }
}

const defaultSettings: AppSettings = {
  apiKeys: {
    deepgram: '',
    google: ''
  },
  defaults: {
    translationDirection: 'en-es',
    outputFolder: '',
    micDeviceId: '',
    systemDeviceId: '',
    sessionNamePattern: 'session-{YYYY}-{MM}-{DD}-{HH}{mm}'
  },
  ui: {
    theme: 'system',
    translationDisplayCount: 3
  }
}

// Load settings
function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const settingsData = fs.readFileSync(settingsFilePath, 'utf-8')
      const savedSettings = JSON.parse(settingsData)
      // Merge with defaults to handle new settings
      return { ...defaultSettings, ...savedSettings }
    }
  } catch (error) {
    console.error('Error loading settings:', error)
  }
  return defaultSettings
}

// Save settings
function saveSettings(settings: AppSettings): boolean {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2))
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// Get settings
ipcMain.handle('settings:get', async () => {
  try {
    const settings = loadSettings()
    return { success: true, settings }
  } catch (error: any) {
    console.error('Error getting settings:', error)
    return { success: false, error: error.message }
  }
})

// Update settings
ipcMain.handle('settings:update', async (event, newSettings: Partial<AppSettings>) => {
  try {
    const currentSettings = loadSettings()
    const updatedSettings = { ...currentSettings, ...newSettings }
    const saved = saveSettings(updatedSettings)
    if (saved) {
      return { success: true, settings: updatedSettings }
    } else {
      return { success: false, error: 'Failed to save settings' }
    }
  } catch (error: any) {
    console.error('Error updating settings:', error)
    return { success: false, error: error.message }
  }
})

// Modified getApiKeys to check settings first, then env vars
ipcMain.handle('config:getApiKeys', async () => {
  console.log('Getting API keys...')
  
  // First try to get from settings
  const settings = loadSettings()
  let deepgramApiKey = settings.apiKeys.deepgram
  let googleApiKey = settings.apiKeys.google
  
  // Fall back to environment variables if not in settings
  if (!deepgramApiKey) {
    deepgramApiKey = process.env.DEEPGRAM_API_KEY || 'your_deepgram_api_key_here'
  }
  if (!googleApiKey) {
    googleApiKey = process.env.GOOGLE_API_KEY || 'your_google_api_key_here'
  }
  
  console.log('DEEPGRAM_API_KEY:', deepgramApiKey !== 'your_deepgram_api_key_here' ? 'Found' : 'Missing')
  console.log('GOOGLE_API_KEY:', googleApiKey !== 'your_google_api_key_here' ? 'Found' : 'Missing')
  
  return {
    deepgramApiKey,
    googleApiKey
  }
})
