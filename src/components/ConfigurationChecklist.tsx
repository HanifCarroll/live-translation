import { memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface ConfigurationChecklistProps {
  micSelected: boolean
  outputFolderSelected: boolean
  hasApiKeys: boolean
  onOpenSettings?: () => void
}

export const ConfigurationChecklist = memo(function ConfigurationChecklist({
  micSelected,
  outputFolderSelected,
  hasApiKeys,
  onOpenSettings
}: ConfigurationChecklistProps) {
  const { isDarkMode } = useTheme()

  const CheckIcon = () => (
    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  )

  const XIcon = () => (
    <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )

  const allConfigured = micSelected && outputFolderSelected && hasApiKeys

  return (
    <div className={`rounded-lg border p-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="text-center mb-6">
        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
          allConfigured 
            ? 'bg-green-100 text-green-600' 
            : isDarkMode 
              ? 'bg-gray-700 text-gray-400' 
              : 'bg-gray-100 text-gray-400'
        }`}>
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        </div>
        <h3 className={`text-lg font-semibold mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
          {allConfigured ? 'Ready to Record!' : 'Setup Required'}
        </h3>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {allConfigured 
            ? 'All requirements are met. Click "Start Recording" to begin.' 
            : 'Complete the setup steps below to start translating.'
          }
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-3">
          {hasApiKeys ? <CheckIcon /> : <XIcon />}
          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            API Keys configured
          </span>
          {!hasApiKeys && (
            <button
              onClick={onOpenSettings}
              className="ml-auto text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
            >
              Setup
            </button>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {micSelected ? <CheckIcon /> : <XIcon />}
          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Microphone selected
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {outputFolderSelected ? <CheckIcon /> : <XIcon />}
          <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Output folder selected
          </span>
        </div>
      </div>

      {allConfigured && (
        <div className={`mt-4 p-3 rounded-md ${isDarkMode ? 'bg-green-900/20 border border-green-800' : 'bg-green-50 border border-green-200'}`}>
          <p className={`text-sm ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
            ✨ Everything is ready! You can now start recording and translating.
          </p>
        </div>
      )}
    </div>
  )
})