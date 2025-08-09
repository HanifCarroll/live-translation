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

  // Status color and icon
  const getStatusConfig = () => {
    switch (appState.status) {
      case 'READY':
        return { color: 'bg-gray-500', icon: '⏸', text: 'Ready' }
      case 'CONNECTING':
        return { color: 'bg-yellow-500', icon: '🔄', text: 'Connecting...' }
      case 'LISTENING':
        return { color: 'bg-green-500', icon: '🎤', text: 'Listening' }
      case 'RECONNECTING':
        return { color: 'bg-orange-500', icon: '🔄', text: 'Reconnecting...' }
      case 'ERROR':
        return { color: 'bg-red-500', icon: '⚠️', text: 'Error' }
      default:
        return { color: 'bg-gray-500', icon: '⏸', text: 'Unknown' }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Modern Header */}
      <header className="glass-dark border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-xl">🌐</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Live Translator</h1>
            </div>
            
            {/* Status Badge */}
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full glass ${appState.isRecording ? 'status-connecting' : ''}`}>
                <div className={`w-2 h-2 rounded-full ${statusConfig.color} ${appState.isRecording ? 'pulse-dot' : ''}`}></div>
                <span className="text-sm text-white/80">{statusConfig.text}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settings Panel */}
          <div className="lg:col-span-2 space-y-6">
            {/* Translation Direction Card */}
            <div className="glass rounded-2xl p-6 transition-all hover:shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="mr-2">🔄</span> Translation Direction
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setAppState(prev => ({ ...prev, direction: 'en-es' }))}
                  className={`py-3 px-4 rounded-xl font-medium transition-all ${
                    appState.direction === 'en-es'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
                      : 'glass text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm opacity-80">English</div>
                  <div className="text-xs">→</div>
                  <div className="text-sm opacity-80">Spanish</div>
                </button>
                <button
                  onClick={() => setAppState(prev => ({ ...prev, direction: 'es-en' }))}
                  className={`py-3 px-4 rounded-xl font-medium transition-all ${
                    appState.direction === 'es-en'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg transform scale-105'
                      : 'glass text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="text-sm opacity-80">Spanish</div>
                  <div className="text-xs">→</div>
                  <div className="text-sm opacity-80">English</div>
                </button>
              </div>
            </div>

            {/* Audio Input Card */}
            <div className="glass rounded-2xl p-6 transition-all hover:shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="mr-2">🎤</span> Audio Input
              </h3>
              
              {/* Microphone Selection */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Primary Microphone
                  </label>
                  <select
                    value={appState.micDeviceId || ''}
                    onChange={(e) => setAppState(prev => ({ ...prev, micDeviceId: e.target.value || null }))}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    <option value="" className="bg-gray-800">Select microphone...</option>
                    {micDevices.map(device => (
                      <option key={device.deviceId} value={device.deviceId} className="bg-gray-800">
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* System Audio Helper */}
                <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl p-4 border border-white/10">
                  <div className="flex items-start space-x-3">
                    <div className="text-2xl">💡</div>
                    <div className="flex-1">
                      <p className="font-medium text-white mb-2">
                        Want to translate system audio too?
                      </p>
                      <p className="text-sm text-white/70 mb-3">
                        Capture audio from Zoom, YouTube, or any app with virtual audio software:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => openExternalUrl('https://existential.audio/blackhole/')}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-all"
                        >
                          macOS: BlackHole
                        </button>
                        <button
                          onClick={() => openExternalUrl('https://vb-audio.com/Cable/')}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-all"
                        >
                          Windows: VB-Cable
                        </button>
                      </div>
                      <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="mt-3 text-sm text-purple-300 hover:text-purple-200 underline transition-colors"
                      >
                        {showAdvanced ? 'Hide advanced options' : 'I have virtual audio installed'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Advanced Audio Options */}
                {showAdvanced && (
                  <div className="animate-slideIn">
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Virtual Audio Device
                    </label>
                    <select
                      value={appState.systemDeviceId || ''}
                      onChange={(e) => setAppState(prev => ({ ...prev, systemDeviceId: e.target.value || null }))}
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    >
                      <option value="" className="bg-gray-800">Select virtual device...</option>
                      {systemDevices.map(device => {
                        const isVirtual = device.label && ['blackhole', 'virtual', 'soundflower', 'loopback'].some(keyword => 
                          device.label!.toLowerCase().includes(keyword)
                        )
                        return (
                          <option key={device.deviceId} value={device.deviceId} className="bg-gray-800">
                            {isVirtual ? '⭐ ' : ''}{device.label || `Device ${device.deviceId.slice(0, 8)}`}
                          </option>
                        )
                      })}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Output Settings Card */}
            <div className="glass rounded-2xl p-6 transition-all hover:shadow-xl">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <span className="mr-2">💾</span> Output Settings
              </h3>
              
              <div className="space-y-4">
                {/* Output Folder */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Save Location
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={appState.outputFolder || ''}
                      readOnly
                      placeholder="No folder selected"
                      className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none transition-all"
                    />
                    <button
                      onClick={selectFolder}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all"
                    >
                      Browse
                    </button>
                  </div>
                </div>

                {/* Session Name */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Session Name
                  </label>
                  <input
                    type="text"
                    value={appState.sessionName || ''}
                    onChange={(e) => setAppState(prev => ({ ...prev, sessionName: e.target.value || generateSessionName() }))}
                    placeholder="Auto-generating..."
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-white/50 mt-2">
                    Files: {appState.sessionName || 'session'}-en.txt, {appState.sessionName || 'session'}-es.txt
                  </p>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && !appState.isRecording && (
              <div className="flex items-center space-x-2 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300">
                <span>⚠️</span>
                <span className="text-sm">{errorMessage}</span>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleStartStop}
              disabled={!canStart && !appState.isRecording}
              className={`w-full py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 ${
                appState.isRecording
                  ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-xl recording-indicator'
                  : canStart
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-xl hover:shadow-2xl'
                  : 'bg-gray-700/50 text-gray-400 cursor-not-allowed'
              }`}
            >
              {appState.isRecording ? (
                <span className="flex items-center justify-center">
                  <span className="mr-2">⏹</span> Stop Recording
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  <span className="mr-2">▶️</span> Start Recording
                </span>
              )}
            </button>
          </div>

          {/* Translation Display */}
          <div className="lg:col-span-1">
            <div className="glass rounded-2xl p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                <span className="flex items-center">
                  <span className="mr-2">📝</span> Live Translation
                </span>
                {appState.isRecording && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-red-400">LIVE</span>
                  </div>
                )}
              </h3>
              
              <div className="min-h-[400px] max-h-[600px] overflow-y-auto custom-scrollbar space-y-3">
                {translationLines.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[400px] text-center">
                    <div className="text-6xl mb-4 opacity-20">🎙️</div>
                    <p className="text-white/50 text-sm">
                      Translations will appear here
                    </p>
                    <p className="text-white/30 text-xs mt-2">
                      Press Start to begin
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {translationLines.map((line, index) => (
                      <div
                        key={line.id}
                        className={`p-4 rounded-xl glass-dark border border-white/10 ${
                          index === translationLines.length - 1 ? 'new-line' : ''
                        }`}
                      >
                        <p className="text-white leading-relaxed">{line.text}</p>
                        <p className="text-xs text-white/30 mt-2">
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
    </div>
  )
}

export default App