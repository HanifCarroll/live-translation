import { useRef, useCallback, useEffect, useState } from 'react'
import { DeepgramClient, TranscriptResult } from '../components/DeepgramClient'
import { TranslationService, TranslationDirection } from '../components/TranslationService'
import { AudioMixer } from '../components/AudioMixer'
import toast from 'react-hot-toast'

export interface TranslationLine {
  id: string
  text: string
  timestamp: number
  original?: string
}

export type RecordingState = 'idle' | 'initializing' | 'recording' | 'stopping'

class RecordingError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'RecordingError'
  }
}

class ValidationError extends RecordingError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

class ServiceInitializationError extends RecordingError {
  constructor(message: string, public service: string) {
    super(message, 'SERVICE_INIT_ERROR')
    this.name = 'ServiceInitializationError'
  }
}

class ApiKeyError extends RecordingError {
  constructor(service: string) {
    super(`${service} API key not configured. Please set it in Settings.`, 'API_KEY_ERROR')
    this.name = 'ApiKeyError'
  }
}

export interface UseRecordingOptions {
  onTranslationReceived: (line: TranslationLine) => void
  onStatusChange: (status: 'READY' | 'CONNECTING' | 'LISTENING' | 'RECONNECTING' | 'ERROR') => void
  translationDirection: TranslationDirection
  outputFolder: string
  sessionName: string
  micDeviceId: string
  systemDeviceId?: string
}

interface UseRecordingReturn {
  startRecording: () => Promise<void>
  stopRecording: () => Promise<boolean> // Returns true if content was saved
  cleanup: () => Promise<void>
  recordingState: RecordingState
  error: Error | null
  isInitializing: boolean
}

// Constants
const DEEPGRAM_SETUP_DELAY = 500
const DEFAULT_DEEPGRAM_API_KEY = 'your_deepgram_api_key_here'
const DEFAULT_GOOGLE_API_KEY = 'your_google_api_key_here'
const SERVICE_TIMEOUT_MS = 30000

export function useRecording(options: UseRecordingOptions): UseRecordingReturn {
  const audioMixerRef = useRef<AudioMixer | null>(null)
  const deepgramClientRef = useRef<DeepgramClient | null>(null)
  const translationServiceRef = useRef<TranslationService | null>(null)
  const isStoppingRef = useRef<boolean>(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasTranscriptContentRef = useRef<boolean>(false)
  
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [error, setError] = useState<Error | null>(null)
  
  const isInitializing = recordingState === 'initializing'

  const cleanup = useCallback(async () => {
    try {
      // Cancel any ongoing operations
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
      
      if (deepgramClientRef.current) {
        deepgramClientRef.current.stop()
        deepgramClientRef.current = null
      }
      
      if (audioMixerRef.current) {
        audioMixerRef.current.cleanup()
        audioMixerRef.current = null
      }
      
      translationServiceRef.current = null
      
      // Only save files if there was actual content
      if (hasTranscriptContentRef.current) {
        await window.electronAPI.closeTranscriptFiles()
      }
      
      // Reset content tracker
      hasTranscriptContentRef.current = false
      
      setRecordingState('idle')
      setError(null)
    } catch (error) {
      console.error('Error during cleanup:', error)
      setError(error as Error)
    }
  }, [])

  // Helper functions
  const validateRecordingSetup = (outputFolder: string, sessionName: string) => {
    if (!outputFolder || !sessionName) {
      throw new ValidationError('Output folder or session name not set')
    }
  }

  const validateApiKeys = async () => {
    const keys = await window.electronAPI.getApiKeys()
    
    if (!keys.deepgramApiKey || keys.deepgramApiKey === DEFAULT_DEEPGRAM_API_KEY) {
      throw new ApiKeyError('Deepgram')
    }
    
    if (!keys.googleApiKey || keys.googleApiKey === DEFAULT_GOOGLE_API_KEY) {
      throw new ApiKeyError('Google')
    }
    
    return keys
  }

  const initializeAudioCapture = async (micDeviceId: string, systemDeviceId?: string) => {
    audioMixerRef.current = new AudioMixer()
    await audioMixerRef.current.initialize()
    
    await audioMixerRef.current.connectMicrophoneStream(micDeviceId)
    
    if (systemDeviceId) {
      await audioMixerRef.current.connectSystemStream(systemDeviceId)
    }
    
    audioMixerRef.current.getMixedStream()
  }

  const initializeServices = async (apiKeys: { deepgramApiKey: string; googleApiKey: string }) => {
    try {
      deepgramClientRef.current = new DeepgramClient(apiKeys.deepgramApiKey)
      translationServiceRef.current = new TranslationService(apiKeys.googleApiKey)
    } catch (error) {
      throw new ServiceInitializationError(
        `Failed to initialize services: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'services'
      )
    }
  }

  const setupCallbacks = (
    onStatusChange: UseRecordingOptions['onStatusChange'],
    onTranslationReceived: UseRecordingOptions['onTranslationReceived'],
    translationDirection: TranslationDirection
  ) => {
    if (!deepgramClientRef.current) return
    
    deepgramClientRef.current.onConnection((status) => {
      if (status === 'connected') {
        onStatusChange('LISTENING')
        setRecordingState('recording')
      } else if (status === 'reconnecting') {
        onStatusChange('RECONNECTING')
      } else if (status === 'disconnected') {
        if (!isStoppingRef.current) {
          onStatusChange('ERROR')
          setError(new RecordingError('Connection lost', 'CONNECTION_LOST'))
        }
      }
    })
    
    deepgramClientRef.current.onTranscript(async (result: TranscriptResult) => {
      try {
        if (!result.text || !result.text.trim()) return
        
        const translatedText = await translationServiceRef.current!.translateForDirection(
          result.text, 
          translationDirection
        )
        
        if (translatedText) {
          const newLine: TranslationLine = {
            id: Date.now().toString(),
            text: translatedText,
            timestamp: Date.now(),
            original: result.text
          }
          
          onTranslationReceived(newLine)
          
          // Mark that we have content to save
          hasTranscriptContentRef.current = true
          
          const { source, target } = translationServiceRef.current!.getLanguageCodes(translationDirection)
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
        onTranslationReceived(errorLine)
        setError(error as Error)
      }
    })
    
    deepgramClientRef.current.onError((error) => {
      console.error('Deepgram error:', error)
      onStatusChange('ERROR')
      setError(new RecordingError('Deepgram service error', 'DEEPGRAM_ERROR'))
    })
  }

  const connectAndStart = async (translationDirection: TranslationDirection) => {
    if (!deepgramClientRef.current || !audioMixerRef.current || !translationServiceRef.current) {
      throw new ServiceInitializationError('Services not initialized', 'missing_services')
    }
    
    const deepgramLanguage = translationDirection === 'en-es' ? 'en-US' : 'es'
    
    // Create timeout for connection
    const connectionTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new RecordingError('Service connection timeout', 'TIMEOUT')), SERVICE_TIMEOUT_MS)
    })
    
    await Promise.race([
      deepgramClientRef.current.connect({ language: deepgramLanguage }),
      connectionTimeout
    ])
    
    await new Promise(resolve => setTimeout(resolve, DEEPGRAM_SETUP_DELAY))
    
    // Check if still valid (user might have stopped during initialization)
    if (!deepgramClientRef.current || !audioMixerRef.current || !translationServiceRef.current) {
      return false
    }
    
    deepgramClientRef.current.startRecording()
    audioMixerRef.current.mediaRecorder = await audioMixerRef.current.setupDeepgramStreaming(deepgramClientRef.current)
    
    // Final validation check
    if (!deepgramClientRef.current || !audioMixerRef.current || !translationServiceRef.current) {
      return false
    }
    
    await Promise.race([
      translationServiceRef.current.testConnection(),
      connectionTimeout
    ])
    
    return true
  }

  const startRecording = useCallback(async () => {
    const {
      onTranslationReceived,
      onStatusChange,
      translationDirection,
      outputFolder,
      sessionName,
      micDeviceId,
      systemDeviceId
    } = options

    try {
      setRecordingState('initializing')
      setError(null)
      onStatusChange('CONNECTING')
      
      // Create abort controller for this session
      abortControllerRef.current = new AbortController()
      
      validateRecordingSetup(outputFolder, sessionName)
      
      const result = await window.electronAPI.createTranscriptFiles(outputFolder, sessionName)
      if (!result.success) {
        throw new RecordingError(`Failed to create transcript files: ${result.error}`, 'FILE_CREATION_ERROR')
      }
      
      await initializeAudioCapture(micDeviceId, systemDeviceId)
      const apiKeys = await validateApiKeys()
      await initializeServices(apiKeys)
      
      setupCallbacks(onStatusChange, onTranslationReceived, translationDirection)
      
      const success = await connectAndStart(translationDirection)
      if (success) {
        onStatusChange('LISTENING')
        setRecordingState('recording')
      }
      
    } catch (error: any) {
      console.error('Error starting recording:', error)
      setError(error)
      setRecordingState('idle')
      onStatusChange('ERROR')
      
      if (error instanceof ApiKeyError) {
        toast.error(error.message)
      } else if (error instanceof ValidationError) {
        toast.error(error.message)
      } else if (error instanceof ServiceInitializationError) {
        toast.error(`Service error: ${error.message}`)
      } else {
        toast.error(`Failed to start recording: ${error.message}`)
      }
      
      await cleanup()
      throw error
    }
  }, [options, cleanup])

  const stopRecording = useCallback(async (): Promise<boolean> => {
    setRecordingState('stopping')
    isStoppingRef.current = true
    
    const hadContent = hasTranscriptContentRef.current
    
    await cleanup()
    isStoppingRef.current = false
    
    if (hadContent) {
      toast.success('Recording stopped and transcripts saved')
    } else {
      toast.success('Recording stopped - no content to save')
    }
    
    return hadContent
  }, [cleanup])

  // Automatic cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    startRecording,
    stopRecording,
    cleanup,
    recordingState,
    error,
    isInitializing
  }
}