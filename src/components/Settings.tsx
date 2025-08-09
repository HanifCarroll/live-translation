import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

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

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  isDarkMode: boolean
  micDevices: MediaDeviceInfo[]
  systemDevices: MediaDeviceInfo[]
  onSettingsUpdate: (settings: AppSettings) => void
}

export default function Settings({
  isOpen,
  onClose,
  isDarkMode,
  micDevices,
  systemDevices,
  onSettingsUpdate
}: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('api')

  useEffect(() => {
    if (isOpen && !settings) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.getSettings()
      if (result.success) {
        setSettings(result.settings)
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return

    setSaving(true)
    try {
      const result = await window.electronAPI.updateSettings(settings)
      if (result.success) {
        onSettingsUpdate(result.settings)
        toast.success('Settings saved successfully')
        onClose()
      } else {
        toast.error('Failed to save settings: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (path: string, value: any) => {
    if (!settings) return

    const newSettings = { ...settings }
    const keys = path.split('.')
    let current: any = newSettings

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]]
    }
    current[keys[keys.length - 1]] = value

    setSettings(newSettings)
  }

  const selectFolder = async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder()
      if (folderPath) {
        updateSetting('defaults.outputFolder', folderPath)
        toast.success('Default output folder updated')
      }
    } catch (error) {
      console.error('Error selecting folder:', error)
      toast.error('Failed to select folder')
    }
  }

  const testApiKeys = async () => {
    if (!settings) return
    
    // Simple validation
    if (!settings.apiKeys.deepgram) {
      toast.error('Please enter your Deepgram API key')
      return
    }
    if (!settings.apiKeys.google) {
      toast.error('Please enter your Google API key')
      return
    }
    
    toast.success('API keys look valid! They will be tested when you start recording.')
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'api', name: 'API Configuration', icon: '🔑' },
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'audio', name: 'Audio', icon: '🎤' },
    { id: 'display', name: 'Display', icon: '🖥️' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className={`max-w-4xl w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-xl max-h-[90vh] overflow-hidden`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Settings
            </h2>
            <button
              onClick={onClose}
              className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'} transition-colors`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex">
          {/* Sidebar */}
          <div className={`w-48 ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} border-r ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <nav className="p-4">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3 py-2 rounded-md mb-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? isDarkMode
                        ? 'bg-gray-800 text-white'
                        : 'bg-white text-gray-900 shadow-sm'
                      : isDarkMode
                        ? 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading settings...
                </div>
              </div>
            ) : !settings ? (
              <div className="flex items-center justify-center h-48">
                <div className={`text-lg ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                  Failed to load settings
                </div>
              </div>
            ) : (
              <>
                {/* API Configuration Tab */}
                {activeTab === 'api' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        API Configuration
                      </h3>
                      <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Configure your API keys for speech recognition and translation services.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Deepgram API Key
                        </label>
                        <input
                          type="password"
                          value={settings.apiKeys.deepgram}
                          onChange={(e) => updateSetting('apiKeys.deepgram', e.target.value)}
                          placeholder="Enter your Deepgram API key"
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'border-gray-300'
                          }`}
                        />
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Get your API key from{' '}
                          <button
                            onClick={() => window.electronAPI.openExternalUrl('https://console.deepgram.com/')}
                            className="text-indigo-600 hover:text-indigo-700 underline"
                          >
                            Deepgram Console
                          </button>
                        </p>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Google Translate API Key
                        </label>
                        <input
                          type="password"
                          value={settings.apiKeys.google}
                          onChange={(e) => updateSetting('apiKeys.google', e.target.value)}
                          placeholder="Enter your Google API key"
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'border-gray-300'
                          }`}
                        />
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Get your API key from{' '}
                          <button
                            onClick={() => window.electronAPI.openExternalUrl('https://console.cloud.google.com/apis/credentials')}
                            className="text-indigo-600 hover:text-indigo-700 underline"
                          >
                            Google Cloud Console
                          </button>
                        </p>
                      </div>

                      <button
                        onClick={testApiKeys}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium"
                      >
                        Test API Keys
                      </button>
                    </div>
                  </div>
                )}

                {/* General Tab */}
                {activeTab === 'general' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        General Settings
                      </h3>
                      <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Configure default behavior and preferences.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Default Translation Direction
                        </label>
                        <div className="flex space-x-3">
                          <button
                            onClick={() => updateSetting('defaults.translationDirection', 'en-es')}
                            className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all ${
                              settings.defaults.translationDirection === 'en-es'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : isDarkMode 
                                  ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            }`}
                          >
                            English → Spanish
                          </button>
                          <button
                            onClick={() => updateSetting('defaults.translationDirection', 'es-en')}
                            className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all ${
                              settings.defaults.translationDirection === 'es-en'
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

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Default Output Folder
                        </label>
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={settings.defaults.outputFolder}
                            readOnly
                            placeholder="No default folder set"
                            className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                              isDarkMode 
                                ? 'bg-gray-900 border-gray-600 text-gray-300' 
                                : 'bg-gray-50 border-gray-300'
                            }`}
                          />
                          <button
                            onClick={selectFolder}
                            className={`px-4 py-2 border rounded-md text-sm font-medium transition-colors ${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            Browse
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Session Name Pattern
                        </label>
                        <input
                          type="text"
                          value={settings.defaults.sessionNamePattern}
                          onChange={(e) => updateSetting('defaults.sessionNamePattern', e.target.value)}
                          placeholder="session-{YYYY}-{MM}-{DD}-{HH}{mm}"
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'border-gray-300'
                          }`}
                        />
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Use {'{YYYY}'}, {'{MM}'}, {'{DD}'}, {'{HH}'}, {'{mm}'} for date/time formatting
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Tab */}
                {activeTab === 'audio' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Audio Settings
                      </h3>
                      <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Set default audio input devices.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Default Microphone
                        </label>
                        <select
                          value={settings.defaults.micDeviceId}
                          onChange={(e) => updateSetting('defaults.micDeviceId', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'border-gray-300'
                          }`}
                        >
                          <option value="">Auto-select first available</option>
                          {micDevices.map(device => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Default Virtual Audio Device
                        </label>
                        <select
                          value={settings.defaults.systemDeviceId}
                          onChange={(e) => updateSetting('defaults.systemDeviceId', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'border-gray-300'
                          }`}
                        >
                          <option value="">None selected</option>
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
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          For capturing system audio from other applications
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Display Tab */}
                {activeTab === 'display' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        Display Settings
                      </h3>
                      <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        Customize the appearance and behavior of the interface.
                      </p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Theme
                        </label>
                        <div className="flex space-x-3">
                          {[
                            { value: 'light', label: 'Light', icon: '☀️' },
                            { value: 'dark', label: 'Dark', icon: '🌙' },
                            { value: 'system', label: 'System', icon: '💻' }
                          ].map((theme) => (
                            <button
                              key={theme.value}
                              onClick={() => updateSetting('ui.theme', theme.value)}
                              className={`flex-1 py-2 px-3 rounded-md border text-sm font-medium transition-all ${
                                settings.ui.theme === theme.value
                                  ? 'bg-indigo-600 text-white border-indigo-600'
                                  : isDarkMode 
                                    ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <span className="mr-1">{theme.icon}</span>
                              {theme.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          Translation History Count
                        </label>
                        <select
                          value={settings.ui.translationDisplayCount}
                          onChange={(e) => updateSetting('ui.translationDisplayCount', parseInt(e.target.value))}
                          className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
                            isDarkMode 
                              ? 'bg-gray-700 border-gray-600 text-gray-200' 
                              : 'border-gray-300'
                          }`}
                        >
                          <option value="1">1 line</option>
                          <option value="2">2 lines</option>
                          <option value="3">3 lines</option>
                          <option value="5">5 lines</option>
                          <option value="10">10 lines</option>
                        </select>
                        <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
                          Number of recent translations to show in the live view
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} flex justify-end space-x-3`}>
          <button
            onClick={onClose}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              isDarkMode 
                ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={saveSettings}
            disabled={saving || loading}
            className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}