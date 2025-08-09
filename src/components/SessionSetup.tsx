import { memo } from 'react'
import { TranslationDirection } from './TranslationService'
import { useTheme } from '../contexts/ThemeContext'

interface SessionSetupProps {
  direction: TranslationDirection
  onDirectionChange: (direction: TranslationDirection) => void
  micDevices: MediaDeviceInfo[]
  systemDevices: MediaDeviceInfo[]
  selectedMicId: string | null
  selectedSystemId: string | null
  onMicChange: (deviceId: string | null) => void
  onSystemChange: (deviceId: string | null) => void
  outputFolder: string | null
  sessionName: string | null
  onFolderSelect: () => Promise<void>
  onSessionNameChange: (name: string) => void
  onExternalUrlOpen: (url: string) => Promise<void>
  disabled?: boolean
}

export const SessionSetup = memo(function SessionSetup({
  direction,
  onDirectionChange,
  micDevices,
  systemDevices,
  selectedMicId,
  selectedSystemId,
  onMicChange,
  onSystemChange,
  outputFolder,
  sessionName,
  onFolderSelect,
  onSessionNameChange,
  onExternalUrlOpen,
  disabled = false
}: SessionSetupProps) {
  const { isDarkMode } = useTheme()

  return (
    <div className={`rounded-xl border p-8 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h2 className={`text-xl font-semibold mb-8 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
        Session Setup
      </h2>

      <div className="grid grid-cols-12 gap-4 md:gap-3">
        {/* Row 1: Translation Direction - Full Width */}
        <div className="col-span-12 mb-6">
          <label className={`block text-sm font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Translation Direction
          </label>
          <div className="flex rounded-lg border overflow-hidden">
            <button
              onClick={() => onDirectionChange('en-es')}
              disabled={disabled}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                direction === 'en-es'
                  ? 'bg-indigo-600 text-white'
                  : isDarkMode 
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border-r border-gray-600' 
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100 border-r border-gray-300'
              }`}
            >
              English → Spanish
            </button>
            <button
              onClick={() => onDirectionChange('es-en')}
              disabled={disabled}
              className={`flex-1 py-3 px-4 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                direction === 'es-en'
                  ? 'bg-indigo-600 text-white'
                  : isDarkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              Spanish → English
            </button>
          </div>
        </div>

        {/* Row 2: Microphone (6/6) + Save Location (6/6) */}
        <div className="col-span-12 md:col-span-6">
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Microphone
          </label>
          <select
            value={selectedMicId || ''}
            onChange={(e) => onMicChange(e.target.value || null)}
            disabled={disabled}
            className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-200' 
                : 'bg-white border-gray-300'
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

        <div className="col-span-12 md:col-span-6">
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Save Location
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={outputFolder || ''}
              readOnly
              placeholder="No folder selected"
              className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                isDarkMode 
                  ? 'bg-gray-900 border-gray-600 text-gray-300' 
                  : 'bg-gray-50 border-gray-300'
              }`}
            />
            <button
              onClick={onFolderSelect}
              disabled={disabled}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Browse
            </button>
          </div>
        </div>

        {/* Row 3: System Audio (6/6) + Session Name (6/6) */}
        <div className="col-span-12 md:col-span-6 border-t pt-6 mt-6">
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            System Audio (Optional)
          </label>
          <div className={`p-3 rounded-lg mb-3 ${isDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
            <p className={`text-sm mb-2 ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>
              <strong>Want to translate Zoom calls, YouTube videos, or music?</strong>
            </p>
            <p className={`text-xs mb-3 ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
              Your computer normally can't capture audio from other apps for privacy reasons. Virtual audio software creates a bridge to safely route audio to this translator.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onExternalUrlOpen('https://existential.audio/blackhole/')}
                disabled={disabled}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode 
                    ? 'bg-blue-800 border-blue-700 text-blue-200 hover:bg-blue-700' 
                    : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                macOS: Get BlackHole
              </button>
              <button
                onClick={() => onExternalUrlOpen('https://vb-audio.com/Cable/')}
                disabled={disabled}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode 
                    ? 'bg-blue-800 border-blue-700 text-blue-200 hover:bg-blue-700' 
                    : 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Windows: Get VB-Cable
              </button>
            </div>
          </div>
          {systemDevices.length > 0 && (
            <select
              value={selectedSystemId || ''}
              onChange={(e) => onSystemChange(e.target.value || null)}
              disabled={disabled}
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-200' 
                  : 'bg-white border-gray-300'
              }`}
            >
              <option value="">No system audio</option>
              {systemDevices.map(device => {
                const isVirtual = device.label && ['blackhole', 'virtual', 'soundflower', 'loopback'].some(keyword => 
                  device.label!.toLowerCase().includes(keyword)
                )
                return (
                  <option key={device.deviceId} value={device.deviceId}>
                    {isVirtual ? '🎧 ' : ''}{device.label || `Device ${device.deviceId.slice(0, 8)}`}
                  </option>
                )
              })}
            </select>
          )}
          <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            After installing virtual audio software, restart this app and select your virtual device above
          </p>
        </div>

        <div className="col-span-12 md:col-span-6 border-t pt-6 mt-6">
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Session Name
          </label>
          <input
            type="text"
            value={sessionName || ''}
            onChange={(e) => onSessionNameChange(e.target.value)}
            placeholder="Auto-generated"
            disabled={disabled}
            className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-200' 
                : 'bg-white border-gray-300'
            }`}
          />
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Files: {sessionName || 'session'}-en.txt, {sessionName || 'session'}-es.txt
          </p>
        </div>
      </div>
    </div>
  )
})