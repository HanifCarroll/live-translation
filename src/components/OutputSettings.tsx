import { memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface OutputSettingsProps {
  outputFolder: string | null
  sessionName: string | null
  onFolderSelect: () => Promise<void>
  onSessionNameChange: (name: string) => void
  disabled?: boolean
}

export const OutputSettings = memo(function OutputSettings({
  outputFolder,
  sessionName,
  onFolderSelect,
  onSessionNameChange,
  disabled = false
}: OutputSettingsProps) {
  const { isDarkMode } = useTheme()

  return (
    <div className={`rounded-lg border p-6 card-hover-no-lift ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
        Output Settings
      </h3>
      
      <div className="space-y-4">
        {/* Save Location */}
        <div>
          <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Save Location
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={outputFolder || ''}
              readOnly
              placeholder="No folder selected"
              className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                isDarkMode 
                  ? 'bg-gray-900 border-gray-600 text-gray-300' 
                  : 'bg-gray-50 border-gray-300'
              }`}
            />
            <button
              onClick={onFolderSelect}
              disabled={disabled}
              className={`px-4 py-2 border rounded-md text-sm font-medium smooth-transition disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Browse
            </button>
          </div>
        </div>

        {/* Session Name */}
        <div>
          <label className={`block text-sm mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            Session Name
          </label>
          <input
            type="text"
            value={sessionName || ''}
            onChange={(e) => onSessionNameChange(e.target.value)}
            placeholder="Auto-generated"
            disabled={disabled}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode 
                ? 'bg-gray-700 border-gray-600 text-gray-200' 
                : 'border-gray-300'
            }`}
          />
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            Output: {sessionName || 'session'}-en.txt, {sessionName || 'session'}-es.txt
          </p>
        </div>
      </div>
    </div>
  )
})