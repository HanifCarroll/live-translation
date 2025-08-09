import { useState, useEffect, useCallback } from 'react'

interface UseAudioDevicesReturn {
  micDevices: MediaDeviceInfo[]
  systemDevices: MediaDeviceInfo[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useAudioDevices(): UseAudioDevicesReturn {
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([])
  const [systemDevices, setSystemDevices] = useState<MediaDeviceInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const initializeDevices = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Request microphone permission to enumerate devices
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop())
      
      // Enumerate all media devices
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputDevices = devices.filter(device => device.kind === 'audioinput')
      
      setMicDevices(audioInputDevices)
      setSystemDevices(audioInputDevices)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access audio devices'
      setError(errorMessage)
      console.error('Error initializing devices:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initializeDevices()

    // Listen for device changes
    const handleDeviceChange = () => {
      initializeDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [initializeDevices])

  return {
    micDevices,
    systemDevices,
    loading,
    error,
    refresh: initializeDevices
  }
}