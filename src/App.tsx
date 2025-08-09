import { useState, useEffect, useRef } from 'react'
import './App.css'
import { DeepgramClient, TranscriptResult } from './components/DeepgramClient'
import { TranslationService, TranslationDirection } from './components/TranslationService'
import { AudioMixer } from './components/AudioMixer'

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
  

  // Refs for services
  const audioMixerRef = useRef<AudioMixer | null>(null)
  const deepgramClientRef = useRef<DeepgramClient | null>(null)
  const translationServiceRef = useRef<TranslationService | null>(null)

  // Generate session name
  const generateSessionName = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    
    return `session-${year}-${month}-${day}-${hours}${minutes}`
  }

  // Initialize devices and session name on component mount
  useEffect(() => {
    initializeDevices()
    initializeSessionName()
    initializeOutputFolder()
  }, [])

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
              timestamp: Date.now()
            }
            
            setTranslationLines(prev => {
              const updated = [...prev, newLine]
              return updated.slice(-3) // Keep only last 3 lines
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
            timestamp: Date.now()
          }
          setTranslationLines(prev => [...prev, errorLine].slice(-3))
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
      
    } catch (error: any) {
      console.error('Error starting recording:', error)
      setAppState(prev => ({ ...prev, status: 'ERROR', isRecording: false }))
      alert(`Failed to start recording: ${error.message}`)
    }
  }

  const stopRecording = async () => {
    try {
      setAppState(prev => ({ ...prev, isRecording: false }))
      
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
      
    } catch (error) {
      console.error('Error stopping recording:', error)
      setAppState(prev => ({ ...prev, status: 'ERROR' }))
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
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
    }
  }

  const openExternalUrl = async (url: string) => {
    try {
      await window.electronAPI.openExternalUrl(url)
    } catch (error) {
      console.error('Error opening URL:', error)
    }
  }

  const canStart = updateStartButtonState()
  const errorMessage = getErrorMessage()

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Top Bar Controls */}
      <div className="bg-gray-800 p-4 space-y-4">
        {/* Direction Selection */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium">Translation Direction:</label>
          <div className="flex space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="direction"
                value="en-es"
                checked={appState.direction === 'en-es'}
                onChange={(e) => setAppState(prev => ({ ...prev, direction: e.target.value as TranslationDirection }))}
                className="text-blue-600"
              />
              <span>EN→ES</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="radio"
                name="direction"
                value="es-en"
                checked={appState.direction === 'es-en'}
                onChange={(e) => setAppState(prev => ({ ...prev, direction: e.target.value as TranslationDirection }))}
                className="text-blue-600"
              />
              <span>ES→EN</span>
            </label>
          </div>
        </div>

        {/* Microphone Selection */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium w-24">Microphone:</label>
          <select
            value={appState.micDeviceId || ''}
            onChange={(e) => setAppState(prev => ({ ...prev, micDeviceId: e.target.value || null }))}
            className="bg-gray-700 border border-gray-600 rounded px-3 py-2 flex-1 max-w-md"
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
        <div className="bg-blue-900 p-4 rounded-lg">
          <p className="font-medium mb-2">🎯 Want to translate what others are saying too?</p>
          <p className="text-sm mb-3">Right now, this app only captures your microphone. To also translate what you hear in Zoom calls, YouTube videos, or any app audio, you'll need a free tool:</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => openExternalUrl('https://existential.audio/blackhole/')}
              className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded text-sm"
            >
              <div className="font-medium">macOS: BlackHole</div>
              <div className="text-xs opacity-75">Free • 2-minute setup</div>
            </button>
            <button
              onClick={() => openExternalUrl('https://vb-audio.com/Cable/')}
              className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded text-sm"
            >
              <div className="font-medium">Windows: VB-Cable</div>
              <div className="text-xs opacity-75">Free • 2-minute setup</div>
            </button>
            <button
              onClick={() => openExternalUrl('https://wiki.archlinux.org/title/PulseAudio/Examples#Monitor_specific_output')}
              className="bg-blue-700 hover:bg-blue-600 px-3 py-2 rounded text-sm"
            >
              <div className="font-medium">Linux: PulseAudio</div>
              <div className="text-xs opacity-75">Built-in • Terminal setup</div>
            </button>
          </div>
          <p className="text-xs opacity-75 mb-2">Why? Computers block apps from "listening" to system audio for security. These tools create a safe bridge.</p>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-300 hover:text-blue-200 text-sm underline"
          >
            {showAdvanced ? 'Hide virtual audio options' : 'I have virtual audio software'}
          </button>
        </div>

        {/* Advanced System Audio Selection */}
        {showAdvanced && (
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium w-24">Virtual Audio:</label>
            <select
              value={appState.systemDeviceId || ''}
              onChange={(e) => setAppState(prev => ({ ...prev, systemDeviceId: e.target.value || null }))}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 flex-1 max-w-md"
            >
              <option value="">Select your virtual audio device...</option>
              {systemDevices.map(device => {
                const isVirtual = device.label && ['blackhole', 'virtual', 'soundflower', 'loopback'].some(keyword => 
                  device.label!.toLowerCase().includes(keyword)
                )
                return (
                  <option key={device.deviceId} value={device.deviceId}>
                    {isVirtual ? '⭐ ' : ''}{device.label || `Audio Device ${device.deviceId.slice(0, 8)}`}
                  </option>
                )
              })}
            </select>
          </div>
        )}

        {/* Output Folder */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium w-24">Output Folder:</label>
          <div className="flex space-x-2 flex-1 max-w-md">
            <input
              type="text"
              value={appState.outputFolder || ''}
              readOnly
              placeholder="No folder selected"
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 flex-1"
            />
            <button
              onClick={selectFolder}
              className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded whitespace-nowrap"
            >
              Choose Folder
            </button>
          </div>
        </div>

        {/* Session Name */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium w-24">Session Name:</label>
          <div className="flex-1 max-w-md">
            <input
              type="text"
              value={appState.sessionName || ''}
              onChange={(e) => setAppState(prev => ({ ...prev, sessionName: e.target.value || generateSessionName() }))}
              placeholder="Auto-generating..."
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 w-full"
            />
            <div className="text-xs text-gray-400 mt-1">
              Files will be saved as: {appState.sessionName || 'session'}-en.txt, {appState.sessionName || 'session'}-es.txt
            </div>
          </div>
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="text-red-400 text-sm">{errorMessage}</div>
        )}

        {/* Start/Stop Button */}
        <div>
          <button
            onClick={handleStartStop}
            disabled={!canStart && !appState.isRecording}
            className={`px-6 py-3 rounded font-medium ${
              appState.isRecording
                ? 'bg-red-600 hover:bg-red-500'
                : canStart
                ? 'bg-green-600 hover:bg-green-500'
                : 'bg-gray-600 cursor-not-allowed'
            }`}
          >
            {appState.isRecording ? 'Stop' : 'Start'}
          </button>
          <div className="text-xs text-gray-400 mt-1">
            Status: {appState.status}
          </div>
        </div>
      </div>

      {/* Translation Display */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Live Translation</h2>
          <div className="bg-gray-800 rounded-lg p-6 min-h-[300px] space-y-4">
            {translationLines.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                Translations will appear here when you start recording...
              </div>
            ) : (
              translationLines.map((line, index) => (
                <div
                  key={line.id}
                  className={`p-4 bg-gray-700 rounded text-lg ${
                    index === translationLines.length - 1 ? 'new-line' : ''
                  }`}
                >
                  {line.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
