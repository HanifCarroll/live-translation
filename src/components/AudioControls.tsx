import { memo, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface AudioControlsProps {
  micDevices: MediaDeviceInfo[]
  systemDevices: MediaDeviceInfo[]
  selectedMicId: string | null
  selectedSystemId: string | null
  onMicChange: (deviceId: string | null) => void
  onSystemChange: (deviceId: string | null) => void
  onExternalUrlOpen: (url: string) => Promise<void>
  disabled?: boolean
}

export const AudioControls = memo(function AudioControls({
  micDevices,
  systemDevices,
  selectedMicId,
  selectedSystemId,
  onMicChange,
  onSystemChange,
  onExternalUrlOpen,
  disabled = false
}: AudioControlsProps) {
  const { isDarkMode } = useTheme()
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
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
            value={selectedMicId || ''}
            onChange={(e) => onMicChange(e.target.value || null)}
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
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

        {/* System Audio Helper */}
        <div className={`rounded-md p-4 border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-blue-50 border-blue-200'}`}>
          <p className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
            Translate system audio
          </p>
          <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            To capture audio from other apps, install virtual audio software:
          </p>
          <div className="flex flex-wrap gap-2 mb-2">
            <button
              onClick={() => onExternalUrlOpen('https://existential.audio/blackhole/')}
              disabled={disabled}
              className={`text-xs px-2 py-1 border rounded smooth-transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode 
                  ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' 
                  : 'bg-white border-gray-300 hover:bg-gray-50'
              }`}
            >
              macOS: BlackHole
            </button>
            <button
              onClick={() => onExternalUrlOpen('https://vb-audio.com/Cable/')}
              disabled={disabled}
              className={`text-xs px-2 py-1 border rounded smooth-transition disabled:opacity-50 disabled:cursor-not-allowed ${
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
            disabled={disabled}
            className={`text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
              value={selectedSystemId || ''}
              onChange={(e) => onSystemChange(e.target.value || null)}
              disabled={disabled}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
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
  )
})