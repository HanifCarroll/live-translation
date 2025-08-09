import { useRef, useCallback, useEffect } from 'react'
import { AudioMixer } from '../components/AudioMixer'

interface UseAudioCaptureOptions {
  micDeviceId: string
  systemDeviceId?: string
}

interface UseAudioCaptureReturn {
  initialize: () => Promise<void>
  cleanup: () => void
  getMixedStream: () => MediaStream | null
  audioMixer: AudioMixer | null
}

export function useAudioCapture(options: UseAudioCaptureOptions): UseAudioCaptureReturn {
  const audioMixerRef = useRef<AudioMixer | null>(null)

  const initialize = useCallback(async () => {
    const { micDeviceId, systemDeviceId } = options
    
    audioMixerRef.current = new AudioMixer()
    await audioMixerRef.current.initialize()
    
    await audioMixerRef.current.connectMicrophoneStream(micDeviceId)
    
    if (systemDeviceId) {
      await audioMixerRef.current.connectSystemStream(systemDeviceId)
    }
    
    audioMixerRef.current.getMixedStream()
  }, [options])

  const cleanup = useCallback(() => {
    if (audioMixerRef.current) {
      audioMixerRef.current.cleanup()
      audioMixerRef.current = null
    }
  }, [])

  const getMixedStream = useCallback(() => {
    return audioMixerRef.current?.getMixedStream() || null
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    initialize,
    cleanup,
    getMixedStream,
    audioMixer: audioMixerRef.current
  }
}