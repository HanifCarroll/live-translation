import { app, BrowserWindow, ipcMain, dialog, session, shell, safeStorage } from 'electron'
// import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { promises as fs, createWriteStream, WriteStream } from 'node:fs'
import { config as dotenvConfig } from 'dotenv'
import { z } from 'zod'

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load environment variables from .env file
dotenvConfig({ path: path.join(__dirname, '..', '.env') })

// The built directory structure
process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

// Validation schemas
const FilePathSchema = z.string().min(1).max(1000).refine((path) => {
  // Prevent directory traversal
  return !path.includes('..') && !path.includes('~')
}, 'Invalid file path')

const SessionNameSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid session name')

const AppSettingsSchema = z.object({
  apiKeys: z.object({
    deepgram: z.string(),
    google: z.string()
  }),
  defaults: z.object({
    translationDirection: z.enum(['en-es', 'es-en']),
    outputFolder: z.string(),
    micDeviceId: z.string(),
    systemDeviceId: z.string(),
    sessionNamePattern: z.string().max(200)
  }),
  ui: z.object({
    theme: z.enum(['light', 'dark', 'system']),
    translationDisplayCount: z.number().min(1).max(20)
  })
})

type AppSettings = z.infer<typeof AppSettingsSchema>

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

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Enable web security
      allowRunningInsecureContent: false,
      experimentalFeatures: false
    },
  })

  // Set CSP headers for security
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': ['default-src \'self\' \'unsafe-inline\'; script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'; style-src \'self\' \'unsafe-inline\';']
      }
    })
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

// File stream management
interface TranscriptStreams {
  en: WriteStream | null
  es: WriteStream | null
}

const transcriptStreams: TranscriptStreams = { en: null, es: null }

// Cleanup function
async function cleanup() {
  if (transcriptStreams.en) {
    transcriptStreams.en.end()
    transcriptStreams.en = null
  }
  if (transcriptStreams.es) {
    transcriptStreams.es.end()
    transcriptStreams.es = null
  }
}

// App event handlers
app.whenReady().then(() => {
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  await cleanup()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', cleanup)

// Secure settings management
const settingsFilePath = path.join(app.getPath('userData'), 'settings.json')
const keyFilePath = path.join(app.getPath('userData'), 'keys.dat')

async function loadSettings(): Promise<AppSettings> {
  try {
    const settingsData = await fs.readFile(settingsFilePath, 'utf-8')
    const rawSettings = JSON.parse(settingsData)
    const validatedSettings = AppSettingsSchema.parse(rawSettings)
    
    // Load encrypted API keys if available
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encryptedKeys = await fs.readFile(keyFilePath)
        const decryptedKeys = safeStorage.decryptString(encryptedKeys)
        const keys = JSON.parse(decryptedKeys)
        validatedSettings.apiKeys = keys
      } catch (error) {
        console.log('No encrypted keys found, using settings keys')
      }
    }
    
    return { ...defaultSettings, ...validatedSettings }
  } catch (error) {
    console.error('Error loading settings:', error)
    return defaultSettings
  }
}

async function saveSettings(settings: AppSettings): Promise<boolean> {
  try {
    const validatedSettings = AppSettingsSchema.parse(settings)
    
    // Save API keys securely if safeStorage is available
    if (safeStorage.isEncryptionAvailable() && (validatedSettings.apiKeys.deepgram || validatedSettings.apiKeys.google)) {
      const keysData = JSON.stringify(validatedSettings.apiKeys)
      const encryptedKeys = safeStorage.encryptString(keysData)
      await fs.writeFile(keyFilePath, encryptedKeys)
      
      // Remove keys from main settings file
      const settingsToSave = { ...validatedSettings, apiKeys: { deepgram: '', google: '' } }
      await fs.writeFile(settingsFilePath, JSON.stringify(settingsToSave, null, 2))
    } else {
      await fs.writeFile(settingsFilePath, JSON.stringify(validatedSettings, null, 2))
    }
    
    return true
  } catch (error) {
    console.error('Error saving settings:', error)
    return false
  }
}

// IPC handlers with validation
ipcMain.handle('dialog:selectFolder', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Output Folder for Transcripts',
      buttonLabel: 'Select Folder'
    })
    
    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0]
      FilePathSchema.parse(folderPath) // Validate path
      return folderPath
    }
    return null
  } catch (error) {
    console.error('Error in selectFolder:', error)
    throw new Error('Failed to select folder')
  }
})

ipcMain.handle('files:createTranscripts', async (_event, folderPath: string, sessionName: string) => {
  try {
    // Validate inputs
    FilePathSchema.parse(folderPath)
    SessionNameSchema.parse(sessionName)
    
    // Close any existing streams
    await cleanup()
    
    const enPath = path.join(folderPath, `${sessionName}-en.txt`)
    const esPath = path.join(folderPath, `${sessionName}-es.txt`)
    
    // Ensure paths are within the selected folder (security check)
    if (!enPath.startsWith(folderPath) || !esPath.startsWith(folderPath)) {
      throw new Error('Invalid file paths')
    }
    
    transcriptStreams.en = createWriteStream(enPath)
    transcriptStreams.es = createWriteStream(esPath)
    
    return { success: true, folderPath }
  } catch (error: any) {
    console.error('Error creating transcripts:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('files:appendTranscript', async (_event, filename: string, text: string) => {
  try {
    // Validate inputs
    z.enum(['en', 'es']).parse(filename)
    z.string().max(10000).parse(text) // Limit text size
    
    const stream = filename === 'en' ? transcriptStreams.en : transcriptStreams.es
    if (stream && stream.writable) {
      return new Promise<{ success: boolean; error?: string }>((resolve) => {
        stream.write(text + '\n', (error) => {
          if (error) {
            console.error('Error writing to transcript:', error)
            resolve({ success: false, error: error.message })
          } else {
            resolve({ success: true })
          }
        })
      })
    } else {
      return { success: false, error: 'Stream not available' }
    }
  } catch (error: any) {
    console.error('Error appending to transcript:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('files:closeTranscripts', async () => {
  try {
    await cleanup()
    return { success: true }
  } catch (error: any) {
    console.error('Error closing transcripts:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('config:getApiKeys', async () => {
  try {
    console.log('Getting API keys...')
    
    const settings = await loadSettings()
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
    
    return { deepgramApiKey, googleApiKey }
  } catch (error: any) {
    console.error('Error getting API keys:', error)
    return { deepgramApiKey: '', googleApiKey: '' }
  }
})

ipcMain.handle('system:openSettings', async () => {
  try {
    if (process.platform === 'darwin') {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone')
    } else if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:privacy-microphone')
    } else {
      // Linux - open sound settings
      await shell.openExternal('gnome-control-center sound input')
    }
    return { success: true }
  } catch (error: any) {
    console.error('Error opening system settings:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('system:getCurrentDirectory', async () => {
  try {
    return { success: true, path: process.cwd() }
  } catch (error: any) {
    console.error('Error getting current directory:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('system:openExternalUrl', async (_event, url: string) => {
  try {
    // Validate URL for security
    const urlSchema = z.string().url().refine((url) => {
      return url.startsWith('https://') || url.startsWith('http://') || url.startsWith('x-apple.systempreferences:')
    }, 'Invalid URL protocol')
    
    urlSchema.parse(url)
    await shell.openExternal(url)
    return { success: true }
  } catch (error: any) {
    console.error('Error opening external URL:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('files:readTranscript', async (_event, filepath: string) => {
  try {
    // Validate and sanitize file path
    FilePathSchema.parse(filepath)
    
    // Ensure file is a .txt file and within user data or selected folder
    if (!filepath.endsWith('.txt')) {
      throw new Error('Only .txt files are allowed')
    }
    
    const content = await fs.readFile(filepath, 'utf-8')
    return { success: true, content }
  } catch (error: any) {
    console.error('Error reading transcript file:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('files:deleteTranscript', async (_event, filepath: string) => {
  try {
    // Validate and sanitize file path
    FilePathSchema.parse(filepath)
    
    // Ensure file is a .txt file
    if (!filepath.endsWith('.txt')) {
      throw new Error('Only .txt files can be deleted')
    }
    
    await fs.unlink(filepath)
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting transcript file:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('settings:get', async () => {
  try {
    const settings = await loadSettings()
    return { success: true, settings }
  } catch (error: any) {
    console.error('Error getting settings:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('settings:update', async (_event, newSettings: Partial<AppSettings>) => {
  try {
    const currentSettings = await loadSettings()
    const updatedSettings = { ...currentSettings, ...newSettings }
    const saved = await saveSettings(updatedSettings)
    
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