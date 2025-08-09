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
          <div className="flex items-center gap-2 mb-2">
            <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              System Audio (Optional)
            </label>
            <div className="relative group">
              <svg 
                className={`w-4 h-4 cursor-help ${isDarkMode ? 'text-gray-500 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`} 
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div className={`absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10 w-72 ${
                isDarkMode ? 'bg-gray-800 text-gray-200 border border-gray-700' : 'bg-white text-gray-700 border border-gray-200'
              }`}>
                <div className="text-left">
                  <p className="font-medium mb-1">Capture audio from other apps</p>
                  <p className="mb-2">Your OS blocks direct audio capture for privacy. Virtual audio software creates a safe bridge:</p>
                  <div className="text-xs space-y-1">
                    <p><strong>macOS:</strong> BlackHole</p>
                    <p><strong>Windows:</strong> VB-Cable</p>
                    <p><strong>Linux:</strong> PulseAudio loopback</p>
                  </div>
                </div>
                <div className={`absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 ${
                  isDarkMode ? 'bg-gray-800 border-r border-b border-gray-700' : 'bg-white border-r border-b border-gray-200'
                }`}></div>
              </div>
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