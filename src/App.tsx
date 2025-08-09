import { useState, useEffect, useRef } from 'react'
import './App.css'
import { DeepgramClient, TranscriptResult } from './components/DeepgramClient'
import { TranslationService, TranslationDirection } from './components/TranslationService'
import { AudioMixer } from './components/AudioMixer'
import Settings from './components/Settings'
import toast, { Toaster } from 'react-hot-toast'

// Type declarations for Electron API
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>
      createTranscriptFiles: (folderPath: string, sessionName: string) => Promise<{ success: boolean; folderPath?: string; error?: string }>
      appendToTranscript: (filename: string, text: string) => Promise<{ success: boolean; error?: string }>
      closeTranscriptFiles: () => Promise<{ success: boolean; error?: string }>
      getApiKeys: () => Promise<{ deepgramApiKey: string; googleApiKey: string }>
      openSystemSettings: () => Promise<{ success: boolean; error?: string }>
      getCurrentDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>
      openExternalUrl: (url: string) => Promise<{ success: boolean; error?: string }>
      readTranscriptFile: (filepath: string) => Promise<{ success: boolean; content?: string; error?: string }>
      deleteTranscriptFile: (filepath: string) => Promise<{ success: boolean; error?: string }>
      getSettings: () => Promise<{ success: boolean; settings?: any; error?: string }>
      updateSettings: (settings: any) => Promise<{ success: boolean; settings?: any; error?: string }>
    }
  }
}

interface AppState {
  direction: TranslationDirection
  micDeviceId: string | null
  systemDeviceId: string | null
  outputFolder: string | null
  sessionName: string | null
  isRecording: boolean
  status: 'READY' | 'CONNECTING' | 'LISTENING' | 'RECONNECTING' | 'ERROR'
}

interface TranslationLine {
  id: string
  text: string
  timestamp: number
  original?: string
}

interface TranscriptData {
  source: string
  target: string
  sessionName: string
  folderPath: string
}

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

function App() {
  const [appState, setAppState] = useState<AppState>({
    direction: 'en-es',
    micDeviceId: null,
    systemDeviceId: null,
    outputFolder: null,
    sessionName: null,
    isRecording: false,
    status: 'READY'
  })

  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [systemDevices, setSystemDevices] = useState<MediaDeviceInfo[]>([])
  const [translationLines, setTranslationLines] = useState<TranslationLine[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [lastTranscript, setLastTranscript] = useState<TranscriptData | null>(null)
  const [viewingTranscript, setViewingTranscript] = useState(false)
  const [transcriptContent, setTranscriptContent] = useState<{ source: string; target: string } | null>(null)
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  // Refs for services
  const audioMixerRef = useRef<AudioMixer | null>(null)
  const deepgramClientRef = useRef<DeepgramClient | null>(null)
  const translationServiceRef = useRef<TranslationService | null>(null)
  const allTranslationsRef = useRef<TranslationLine[]>([])

  // Apply dark mode class to body
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark')
    } else {
      document.body.classList.remove('dark')
    }
  }, [isDarkMode])

  // Generate session name based on pattern
  const generateSessionName = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    const pattern = settings?.defaults.sessionNamePattern || 'session-{YYYY}-{MM}-{DD}-{HH}{mm}'
    
    return pattern
      .replace('{YYYY}', year.toString())
      .replace('{MM}', month)
      .replace('{DD}', day)
      .replace('{HH}', hours)
      .replace('{mm}', minutes)
  }

  // Initialize app on component mount
  useEffect(() => {
    initializeApp()
  }, [])

  // Apply settings when they change
  useEffect(() => {
    if (settings) {
      applySettings()
    }
  }, [settings])

  const initializeApp = async () => {
    // Load settings first
    await loadSettings()
    
    // Initialize devices and other app state
    initializeDevices()
    initializeSessionName()
    initializeOutputFolder()
  }

  const loadSettings = async () => {
    try {
      const result = await window.electronAPI.getSettings()
      if (result.success && result.settings) {
        setSettings(result.settings)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const applySettings = () => {
    if (!settings) return

    // Apply theme
    const theme = settings.ui.theme
    if (theme === 'system') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDarkMode(prefersDark)
    } else {
      setIsDarkMode(theme === 'dark')
    }

    // Apply default translation direction
    setAppState(prev => ({
      ...prev,
      direction: settings.defaults.translationDirection,
      outputFolder: settings.defaults.outputFolder || prev.outputFolder,
      micDeviceId: settings.defaults.micDeviceId || prev.micDeviceId,
      systemDeviceId: settings.defaults.systemDeviceId || prev.systemDeviceId
    }))

    // Auto-show advanced options if system device is set
    if (settings.defaults.systemDeviceId) {
      setShowAdvanced(true)
    }
  }

  const handleSettingsUpdate = (newSettings: AppSettings) => {
    setSettings(newSettings)
  }

  // Handle auto-selecting virtual audio device when advanced section is toggled
  useEffect(() => {
    if (showAdvanced && systemDevices.length > 0 && !appState.systemDeviceId) {
      const virtualKeywords = ['blackhole', 'virtual', 'soundflower', 'loopback']
      const virtualDevice = systemDevices.find(device => {
        if (!device.label) return false
        const labelLower = device.label.toLowerCase()
        return virtualKeywords.some(keyword => labelLower.includes(keyword))
      })
      
      if (virtualDevice) {
        setAppState(prev => ({ ...prev, systemDeviceId: virtualDevice.deviceId }))
      }
    } else if (!showAdvanced) {
      // Clear system audio selection when advanced section is hidden
      setAppState(prev => ({ ...prev, systemDeviceId: null }))
    }
  }, [showAdvanced, systemDevices])

  const initializeSessionName = () => {
    const sessionName = generateSessionName()
    setAppState(prev => ({ ...prev, sessionName }))
  }

  const initializeOutputFolder = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.getCurrentDirectory()
        if (result.success && result.path) {
          setAppState(prev => ({ ...prev, outputFolder: result.path }))
        }
      }
    } catch (error) {
      console.error('Error getting current directory:', error)
    }
  }

  const initializeDevices = async () => {
    try {
      // Request microphone permission to enumerate devices
      await navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          // Stop the stream immediately, we just needed permission
          stream.getTracks().forEach(track => track.stop())
        })
      
      // Enumerate all media devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput')
      
      setMicDevices(audioInputDevices)
      setSystemDevices(audioInputDevices)
      
      // Auto-select the first available microphone
      if (audioInputDevices.length > 0) {
        const defaultMic = audioInputDevices[0]
        setAppState(prev => ({ ...prev, micDeviceId: defaultMic.deviceId }))
      }
      
      // Listen for device changes
      navigator.mediaDevices.addEventListener('devicechange', initializeDevices)
      
    } catch (error) {
      console.error('Error initializing devices:', error)
    }
  }

  const updateStartButtonState = () => {
    return appState.micDeviceId && appState.outputFolder && !appState.isRecording
  }

  // Calculate error message without causing re-renders
  const getErrorMessage = () => {
    if (appState.isRecording) return ''
    
    if (!appState.micDeviceId) {
      return 'Please select a microphone'
    } else if (!appState.outputFolder) {
      return 'Please select output folder'
    }
    return ''
  }

  const startRecording = async () => {
    try {
      setAppState(prev => ({ ...prev, isRecording: true, status: 'CONNECTING' }))
      allTranslationsRef.current = []
      
      // Create transcript files
      if (!appState.outputFolder || !appState.sessionName) {
        throw new Error('Output folder or session name not set')
      }
      
      const result = await window.electronAPI.createTranscriptFiles(appState.outputFolder, appState.sessionName)
      if (!result.success) {
        throw new Error(`Failed to create transcript files: ${result.error}`)
      }
      
      // Initialize audio capture
      audioMixerRef.current = new AudioMixer()
      await audioMixerRef.current.initialize()
      
      // Connect audio streams
      await audioMixerRef.current.connectMicrophoneStream(appState.micDeviceId!)
      
      if (appState.systemDeviceId) {
        await audioMixerRef.current.connectSystemStream(appState.systemDeviceId)
      }
      
      const mixedStream = audioMixerRef.current.getMixedStream()
      
      // Get API keys
      const apiKeys = await window.electronAPI.getApiKeys()
      if (!apiKeys.deepgramApiKey || apiKeys.deepgramApiKey === 'your_deepgram_api_key_here') {
        throw new Error('Deepgram API key not configured. Please set DEEPGRAM_API_KEY in .env file.')
      }
      if (!apiKeys.googleApiKey || apiKeys.googleApiKey === 'your_google_api_key_here') {
        throw new Error('Google API key not configured. Please set GOOGLE_API_KEY in .env file.')
      }
      
      // Initialize services
      deepgramClientRef.current = new DeepgramClient(apiKeys.deepgramApiKey)
      translationServiceRef.current = new TranslationService(apiKeys.googleApiKey)
      
      // Set up callbacks
      deepgramClientRef.current.onConnection((status) => {
        if (status === 'connected') {
          setAppState(prev => ({ ...prev, status: 'LISTENING' }))
        } else if (status === 'reconnecting') {
          setAppState(prev => ({ ...prev, status: 'RECONNECTING' }))
        } else if (status === 'disconnected') {
          if (appState.isRecording) {
            setAppState(prev => ({ ...prev, status: 'ERROR' }))
          }
        }
      })
      
      deepgramClientRef.current.onTranscript(async (result: TranscriptResult) => {
        try {
          const translatedText = await translationServiceRef.current!.translateForDirection(
            result.text, 
            appState.direction
          )
          
          if (translatedText) {
            // Add to display
            const newLine: TranslationLine = {
              id: Date.now().toString(),
              text: translatedText,
              timestamp: Date.now(),
              original: result.text
            }
            
            allTranslationsRef.current.push(newLine)
            
            setTranslationLines(prev => {
              const updated = [...prev, newLine]
              const displayCount = settings?.ui.translationDisplayCount || 3
              return updated.slice(-displayCount) // Keep only last N lines
            })
            
            // Write to files
            const { source, target } = translationServiceRef.current!.getLanguageCodes(appState.direction)
            await window.electronAPI.appendToTranscript(source, result.text)
            await window.electronAPI.appendToTranscript(target, translatedText)
          }
        } catch (error) {
          console.error('Translation error:', error)
          const errorLine: TranslationLine = {
            id: Date.now().toString(),
            text: `[Translation Error] ${result.text}`,
            timestamp: Date.now(),
            original: result.text
          }
          setTranslationLines(prev => {
            const displayCount = settings?.ui.translationDisplayCount || 3
            return [...prev, errorLine].slice(-displayCount)
          })
        }
      })
      
      deepgramClientRef.current.onError((error) => {
        console.error('Deepgram error:', error)
        setAppState(prev => ({ ...prev, status: 'ERROR' }))
      })
      
      // Connect and start
      await deepgramClientRef.current.connect()
      await new Promise(resolve => setTimeout(resolve, 500))
      
      deepgramClientRef.current.startRecording()
      audioMixerRef.current.mediaRecorder = await audioMixerRef.current.setupDeepgramStreaming(deepgramClientRef.current)
      
      await translationServiceRef.current.testConnection()
      setAppState(prev => ({ ...prev, status: 'LISTENING' }))
      toast.success('Recording started successfully')
      
    } catch (error: any) {
      console.error('Error starting recording:', error)
      setAppState(prev => ({ ...prev, status: 'ERROR', isRecording: false }))
      toast.error(`Failed to start recording: ${error.message}`)
    }
  }

  const stopRecording = async () => {
    try {
      setAppState(prev => ({ ...prev, isRecording: false }))
      
      // Save transcript info before cleanup
      if (appState.outputFolder && appState.sessionName) {
        const { source, target } = translationServiceRef.current?.getLanguageCodes(appState.direction) || { source: 'en', target: 'es' }
        setLastTranscript({
          source: `${appState.outputFolder}/${appState.sessionName}-${source}.txt`,
          target: `${appState.outputFolder}/${appState.sessionName}-${target}.txt`,
          sessionName: appState.sessionName,
          folderPath: appState.outputFolder
        })
      }
      
      // Stop services
      if (deepgramClientRef.current) {
        deepgramClientRef.current.stop()
        deepgramClientRef.current = null
      }
      
      if (audioMixerRef.current) {
        audioMixerRef.current.cleanup()
        audioMixerRef.current = null
      }
      
      translationServiceRef.current = null
      
      // Clear display and close files
      setTranslationLines([])
      await window.electronAPI.closeTranscriptFiles()
      
      setAppState(prev => ({ ...prev, status: 'READY' }))
      setShowOverlay(false)
      toast.success('Recording stopped and transcripts saved')
      
    } catch (error) {
      console.error('Error stopping recording:', error)
      setAppState(prev => ({ ...prev, status: 'ERROR' }))
      toast.error('Error stopping recording')
    }
  }

  const handleStartStop = () => {
    if (appState.isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const selectFolder = async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder()
      if (folderPath) {
        setAppState(prev => ({ ...prev, outputFolder: folderPath }))
        toast.success('Output folder selected')
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
      toast.error('Failed to select folder')
    }
  }

  const openExternalUrl = async (url: string) => {
    try {
      await window.electronAPI.openExternalUrl(url)
    } catch (error) {
      console.error('Error opening URL:', error)
    }
  }

  const viewTranscripts = async () => {
    if (!lastTranscript) return
    
    try {
      const sourceResult = await window.electronAPI.readTranscriptFile(lastTranscript.source)
      const targetResult = await window.electronAPI.readTranscriptFile(lastTranscript.target)
      
      if (sourceResult.success && targetResult.success) {
        setTranscriptContent({
          source: sourceResult.content || '',
          target: targetResult.content || ''
        })
        setViewingTranscript(true)
      } else {
        toast.error('Failed to load transcripts')
      }
    } catch (error) {
      console.error('Error reading transcripts:', error)
      toast.error('Failed to load transcripts')
    }
  }

  const deleteTranscripts = async () => {
    if (!lastTranscript) return
    
    if (confirm('Are you sure you want to delete these transcript files?')) {
      try {
        await window.electronAPI.deleteTranscriptFile(lastTranscript.source)
        await window.electronAPI.deleteTranscriptFile(lastTranscript.target)
        setLastTranscript(null)
        setViewingTranscript(false) // Close the modal
        toast.success('Transcripts deleted successfully')
      } catch (error) {
        console.error('Error deleting transcripts:', error)
        toast.error('Failed to delete transcripts')
      }
    }
  }

  const canStart = updateStartButtonState()
  const errorMessage = getErrorMessage()

  // Status configuration
  const getStatusConfig = () => {
    switch (appState.status) {
      case 'READY':
        return { color: isDarkMode ? 'bg-gray-600' : 'bg-gray-400', text: 'Ready' }
      case 'CONNECTING':
        return { color: 'bg-yellow-500', text: 'Connecting' }
      case 'LISTENING':
        return { color: 'bg-green-500', text: 'Listening' }
      case 'RECONNECTING':
        return { color: 'bg-orange-500', text: 'Reconnecting' }
      case 'ERROR':
        return { color: 'bg-red-500', text: 'Error' }
      default:
        return { color: isDarkMode ? 'bg-gray-600' : 'bg-gray-400', text: 'Unknown' }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      {/* Full Screen Overlay */}
      {showOverlay && appState.isRecording && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="max-w-4xl w-full mx-auto p-8">
            <button
              onClick={() => setShowOverlay(false)}
              className="absolute top-8 right-8 text-white hover:text-gray-300"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="text-center">
              <h2 className="text-3xl font-bold text-white mb-8">Live Translation</h2>
              <div className="space-y-6">
                {translationLines.length === 0 ? (
                  <p className="text-gray-400 text-xl">Listening...</p>
                ) : (
                  translationLines.map((line, index) => (
                    <div
                      key={line.id}
                      className={`text-white ${index === translationLines.length - 1 ? 'text-4xl font-medium new-line' : 'text-2xl opacity-60'}`}
                    >
                      {line.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript Viewer Modal */}
      {viewingTranscript && transcriptContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className={`max-w-6xl w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-h-[90vh] overflow-hidden`}>
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Session Transcripts: {lastTranscript?.sessionName}
                </h2>
                <button
                  onClick={() => setViewingTranscript(false)}
                  className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div>
                <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {appState.direction === 'en-es' ? 'English (Source)' : 'Spanish (Source)'}
                </h3>
                <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} overflow-y-auto max-h-96`}>
                  <pre className={`text-sm whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {transcriptContent.source || 'No content'}
                  </pre>
                </div>
              </div>
              <div>
                <h3 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {appState.direction === 'en-es' ? 'Spanish (Translation)' : 'English (Translation)'}
                </h3>
                <div className={`p-4 rounded-md ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} overflow-y-auto max-h-96`}>
                  <pre className={`text-sm whitespace-pre-wrap ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {transcriptContent.target || 'No content'}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end space-x-3`}>
              <button
                onClick={deleteTranscripts}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
              >
                Delete Transcripts
              </button>
              <button
                onClick={() => setViewingTranscript(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimalist Header */}
      <header className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b`}>
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Live Translator
            </h1>
            
            <div className="flex items-center space-x-4">
              {/* Status Indicator */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${statusConfig.color} ${appState.isRecording ? 'pulse-dot' : ''}`}></div>
                <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{statusConfig.text}</span>
              </div>
              
              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} hover:bg-opacity-80`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => {
                  const newMode = !isDarkMode
                  setIsDarkMode(newMode)
                  // Update settings if available
                  if (settings) {
                    const newSettings = {
                      ...settings,
                      ui: {
                        ...settings.ui,
                        theme: newMode ? 'dark' : 'light'
                      }
                    }
                    window.electronAPI.updateSettings(newSettings)
                    setSettings(newSettings)
                  }
                }}
                className={`p-2 rounded-md ${isDarkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-100 text-gray-600'} hover:bg-opacity-80`}
              >
                {isDarkMode ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Post-Recording Actions */}
        {lastTranscript && !appState.isRecording && (
          <div className={`mb-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  Session completed: {lastTranscript.sessionName}
                </p>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                  Saved to: {lastTranscript.folderPath}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={viewTranscripts}
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                >
                  View Transcripts
                </button>
                <button
                  onClick={deleteTranscripts}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Settings Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Translation Direction */}
            <div className={`rounded-lg border p-6 card-hover-no-lift ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                Translation Direction
              </h3>
              <div className="flex space-x-3">
                <button
                  onClick={() => setAppState(prev => ({ ...prev, direction: 'en-es' }))}
                  className={`flex-1 py-2.5 px-4 rounded-md border text-sm font-medium smooth-transition ${
                    appState.direction === 'en-es'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isDarkMode 
                        ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  English → Spanish
                </button>
                <button
                  onClick={() => setAppState(prev => ({ ...prev, direction: 'es-en' }))}
                  className={`flex-1 py-2.5 px-4 rounded-md border text-sm font-medium smooth-transition ${
                    appState.direction === 'es-en'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isDarkMode
                        ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Spanish → English
                </button>
              </div>
            </div>

            {/* Audio Input */}
            <div className={`rounded-lg border p-6 card-hover-no-lift ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                Audio Input
              </h3>
              
              <div className="space-y-4">
                {/* Microphone Selection */}
                <div>
                  <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Microphone
                  </label>
                  <select
                    value={appState.micDeviceId || ''}
                    onChange={(e) => setAppState(prev => ({ ...prev, micDeviceId: e.target.value || null }))}
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-200' 
                        : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select microphone...</option>
                    {micDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* System Audio Info */}
                <div className={`rounded-md p-4 border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-blue-50 border-blue-200'}`}>
                  <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                    Translate system audio
                  </p>
                  <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    To capture audio from other apps, install virtual audio software:
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <button
                      onClick={() => openExternalUrl('https://existential.audio/blackhole/')}
                      className={`text-xs px-2 py-1 border rounded smooth-transition ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      macOS: BlackHole
                    </button>
                    <button
                      onClick={() => openExternalUrl('https://vb-audio.com/Cable/')}
                      className={`text-xs px-2 py-1 border rounded smooth-transition ${
                        isDarkMode 
                          ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
                          : 'bg-white border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      Windows: VB-Cable
                    </button>
                  </div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`text-xs transition-colors ${
                      isDarkMode 
                        ? 'text-indigo-400 hover:text-indigo-300' 
                        : 'text-indigo-600 hover:text-indigo-700'
                    }`}
                  >
                    {showAdvanced ? 'Hide options' : 'I have virtual audio installed →'}
                  </button>
                </div>

                {/* Virtual Audio Selection */}
                {showAdvanced && (
                  <div className="animate-fadeIn">
                    <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      Virtual Audio Device
                    </label>
                    <select
                      value={appState.systemDeviceId || ''}
                      onChange={(e) => setAppState(prev => ({ ...prev, systemDeviceId: e.target.value || null }))}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-200' 
                          : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select virtual device...</option>
                      {systemDevices.map(device => {
                        const isVirtual = device.label && ['blackhole', 'virtual', 'soundflower', 'loopback'].some(keyword => 
                          device.label!.toLowerCase().includes(keyword)
                        )
                        return (
                          <option key={device.deviceId} value={device.deviceId}>
                            {isVirtual ? '• ' : ''}{device.label || `Device ${device.deviceId.slice(0, 8)}`}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Output Settings */}
            <div className={`rounded-lg border p-6 card-hover-no-lift ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <h3 className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                Output Settings
              </h3>
              
              <div className="space-y-4">
                {/* Save Location */}
                <div>
                  <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Save Location
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={appState.outputFolder || ''}
                      readOnly
                      placeholder="No folder selected"
                      className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                        isDarkMode 
                          ? 'bg-gray-900 border-gray-600 text-gray-300' 
                          : 'bg-gray-50 border-gray-300'
                      }`}
                    />
                    <button
                      onClick={selectFolder}
                      className={`px-4 py-2 border rounded-md text-sm font-medium smooth-transition ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Browse
                    </button>
                  </div>
                </div>

                {/* Session Name */}
                <div>
                  <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Session Name
                  </label>
                  <input
                    type="text"
                    value={appState.sessionName || ''}
                    onChange={(e) => setAppState(prev => ({ ...prev, sessionName: e.target.value || generateSessionName() }))}
                    placeholder="Auto-generated"
                    className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-gray-200' 
                        : 'border-gray-300'
                    }`}
                  />
                  <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                    Output: {appState.sessionName || 'session'}-en.txt, {appState.sessionName || 'session'}-es.txt
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && !appState.isRecording && (
              <div className={`px-4 py-3 rounded-md border ${
                isDarkMode 
                  ? 'bg-red-900/20 border-red-800 text-red-400' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <p className="text-sm">{errorMessage}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={handleStartStop}
                disabled={!canStart && !appState.isRecording}
                className={`flex-1 py-3 px-4 rounded-md font-medium text-sm smooth-transition btn-minimal ${
                  appState.isRecording
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : canStart
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : isDarkMode
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {appState.isRecording ? 'Stop Recording' : 'Start Recording'}
              </button>
              
              {appState.isRecording && (
                <button
                  onClick={() => setShowOverlay(true)}
                  className="px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm font-medium"
                >
                  Show Fullscreen
                </button>
              )}
            </div>
          </div>

          {/* Translation Display */}
          <div className="lg:col-span-1">
            <div className={`rounded-lg border p-6 sticky top-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  Live Translation
                </h3>
                {appState.isRecording && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700'
                  }`}>
                    <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1.5 status-dot"></span>
                    Live
                  </span>
                )}
              </div>
              
              <div className="min-h-[400px] max-h-[500px] overflow-y-auto custom-scrollbar">
                {translationLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <svg className={`w-16 h-16 mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Waiting for audio...
                    </p>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                      Start recording to see translations
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {translationLines.map((line, index) => (
                      <div
                        key={line.id}
                        className={`p-3 rounded-md border ${
                          isDarkMode 
                            ? 'bg-gray-900 border-gray-700' 
                            : 'bg-gray-50 border-gray-200'
                        } ${index === translationLines.length - 1 ? 'new-line' : ''}`}
                      >
                        <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                          {line.text}
                        </p>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {new Date(line.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isDarkMode={isDarkMode}
        micDevices={micDevices}
        systemDevices={systemDevices}
        onSettingsUpdate={handleSettingsUpdate}
      />
      
      {/* Toast Container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDarkMode ? '#374151' : '#ffffff',
            color: isDarkMode ? '#f9fafb' : '#111827',
            border: isDarkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: isDarkMode ? '#374151' : '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: isDarkMode ? '#374151' : '#ffffff',
            },
          },
        }}
      />
    </div>
  )
}

export default App