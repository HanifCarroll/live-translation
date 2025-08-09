import { useRef, useCallback } from 'react'
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
  stopRecording: () => Promise<void>
  cleanup: () => Promise<void>
}

export function useRecording(options: UseRecordingOptions): UseRecordingReturn {
  const audioMixerRef = useRef<AudioMixer | null>(null)
  const deepgramClientRef = useRef<DeepgramClient | null>(null)
  const translationServiceRef = useRef<TranslationService | null>(null)
  const isStoppingRef = useRef<boolean>(false)

  const cleanup = useCallback(async () => {
    try {
      if (deepgramClientRef.current) {
        deepgramClientRef.current.stop()
        deepgramClientRef.current = null
      }
      
      if (audioMixerRef.current) {
        audioMixerRef.current.cleanup()
        audioMixerRef.current = null
      }
      
      translationServiceRef.current = null
      
      await window.electronAPI.closeTranscriptFiles()
    } catch (error) {
      console.error('Error during cleanup:', error)
    }
  }, [])

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
      onStatusChange('CONNECTING')
      
      if (!outputFolder || !sessionName) {
        throw new Error('Output folder or session name not set')
      }
      
      const result = await window.electronAPI.createTranscriptFiles(outputFolder, sessionName)
      if (!result.success) {
        throw new Error(`Failed to create transcript files: ${result.error}`)
      }
      
      // Initialize audio capture
      audioMixerRef.current = new AudioMixer()
      await audioMixerRef.current.initialize()
      
      // Connect audio streams
      await audioMixerRef.current.connectMicrophoneStream(micDeviceId)
      
      if (systemDeviceId) {
        await audioMixerRef.current.connectSystemStream(systemDeviceId)
      }
      
      audioMixerRef.current.getMixedStream()
      
      // Get API keys
      const apiKeys = await window.electronAPI.getApiKeys()
      if (!apiKeys.deepgramApiKey || apiKeys.deepgramApiKey === 'your_deepgram_api_key_here') {
        throw new Error('Deepgram API key not configured. Please set it in Settings.')
      }
      if (!apiKeys.googleApiKey || apiKeys.googleApiKey === 'your_google_api_key_here') {
        throw new Error('Google API key not configured. Please set it in Settings.')
      }
      
      // Initialize services
      deepgramClientRef.current = new DeepgramClient(apiKeys.deepgramApiKey)
      translationServiceRef.current = new TranslationService(apiKeys.googleApiKey)
      
      // Set up callbacks
      deepgramClientRef.current.onConnection((status) => {
        if (status === 'connected') {
          onStatusChange('LISTENING')
        } else if (status === 'reconnecting') {
          onStatusChange('RECONNECTING')
        } else if (status === 'disconnected') {
          // Only treat disconnection as error if we're not intentionally stopping
          if (!isStoppingRef.current) {
            onStatusChange('ERROR')
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
            
            // Write to files
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
        }
      })
      
      deepgramClientRef.current.onError((error) => {
        console.error('Deepgram error:', error)
        onStatusChange('ERROR')
      })
      
      // Connect and start with correct language
      const deepgramLanguage = translationDirection === 'en-es' ? 'en-US' : 'es'
      await deepgramClientRef.current.connect({ language: deepgramLanguage })
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Check if still valid (user might have stopped during initialization)
      if (!deepgramClientRef.current || !audioMixerRef.current || !translationServiceRef.current) {
        throw new Error('CANCELLED')
      }
      
      deepgramClientRef.current.startRecording()
      audioMixerRef.current.mediaRecorder = await audioMixerRef.current.setupDeepgramStreaming(deepgramClientRef.current)
      
      await translationServiceRef.current.testConnection()
      onStatusChange('LISTENING')
      
    } catch (error: any) {
      console.error('Error starting recording:', error)
      onStatusChange('ERROR')
      // Don't show toast for user cancellation
      if (error?.message !== 'CANCELLED') {
        toast.error(`Failed to start recording: ${error.message}`)
      }
      await cleanup()
      throw error
    }
  }, [options, cleanup])

  const stopRecording = useCallback(async () => {
    isStoppingRef.current = true
    await cleanup()
    isStoppingRef.current = false
    toast.success('Recording stopped and transcripts saved')
  }, [cleanup])

  return {
    startRecording,
    stopRecording,
    cleanup
  }
}