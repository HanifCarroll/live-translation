import { useRef, useCallback, useEffect } from 'react'
import { DeepgramClient, TranscriptResult, ConnectionStatus } from '../components/DeepgramClient'
import { TranslationDirection } from '../components/TranslationService'

interface UseTranscriptionOptions {
  apiKey: string
  translationDirection: TranslationDirection
  onTranscript?: (result: TranscriptResult) => void
  onConnection?: (status: ConnectionStatus) => void
  onError?: (error: any) => void
}

interface UseTranscriptionReturn {
  connect: () => Promise<void>
  startRecording: () => void
  stop: () => void
  sendAudio: (audioData: ArrayBuffer) => void
  deepgramClient: DeepgramClient | null
}

export function useTranscription(options: UseTranscriptionOptions): UseTranscriptionReturn {
  const deepgramClientRef = useRef<DeepgramClient | null>(null)

  const connect = useCallback(async () => {
    const { apiKey, translationDirection, onTranscript, onConnection, onError } = options
    
    deepgramClientRef.current = new DeepgramClient(apiKey)
    
    if (onTranscript) {
      deepgramClientRef.current.onTranscript(onTranscript)
    }
    
    if (onConnection) {
      deepgramClientRef.current.onConnection(onConnection)
    }
    
    if (onError) {
      deepgramClientRef.current.onError(onError)
    }
    
    const deepgramLanguage = translationDirection === 'en-es' ? 'en-US' : 'es'
    await deepgramClientRef.current.connect({ language: deepgramLanguage })
  }, [options])

  const startRecording = useCallback(() => {
    if (deepgramClientRef.current) {
      deepgramClientRef.current.startRecording()
    }
  }, [])

  const stop = useCallback(() => {
    if (deepgramClientRef.current) {
      deepgramClientRef.current.stop()
      deepgramClientRef.current = null
    }
  }, [])

  const sendAudio = useCallback((audioData: ArrayBuffer) => {
    if (deepgramClientRef.current) {
      deepgramClientRef.current.sendAudio(audioData)
    }
  }, [])

  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  return {
    connect,
    startRecording,
    stop,
    sendAudio,
    deepgramClient: deepgramClientRef.current
  }
}