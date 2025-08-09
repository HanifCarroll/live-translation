import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

export interface AppSettings {
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

interface UseSettingsReturn {
  settings: AppSettings | null
  loading: boolean
  error: string | null
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<boolean>
  refreshSettings: () => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await window.electronAPI.getSettings()
      if (result.success && result.settings) {
        setSettings(result.settings)
      } else {
        setError(result.error || 'Failed to load settings')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings'
      setError(errorMessage)
      console.error('Failed to load settings:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>): Promise<boolean> => {
    if (!settings) return false

    try {
      const updatedSettings = { ...settings, ...newSettings }
      const result = await window.electronAPI.updateSettings(updatedSettings)
      
      if (result.success && result.settings) {
        setSettings(result.settings)
        return true
      } else {
        toast.error(result.error || 'Failed to save settings')
        return false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save settings'
      toast.error(errorMessage)
      console.error('Failed to save settings:', err)
      return false
    }
  }, [settings])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  return {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings: loadSettings
  }
}