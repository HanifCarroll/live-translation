import { memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

export interface TranslationLine {
  id: string
  text: string
  timestamp: number
  original?: string
}

interface TranslationDisplayProps {
  translationLines: TranslationLine[]
  isRecording: boolean
  onShowFullscreen?: () => void
}

export const TranslationDisplay = memo(function TranslationDisplay({
  translationLines,
  isRecording,
  onShowFullscreen
}: TranslationDisplayProps) {
  const { isDarkMode } = useTheme()

  return (
    <div className={`rounded-lg border p-6 sticky top-6 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
          Live Translation
        </h3>
        <div className="flex items-center space-x-2">
          {isRecording && (
            <>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                isDarkMode ? 'bg-red-900/50 text-red-400' : 'bg-red-100 text-red-700'
              }`}>
                <span className="w-1.5 h-1.5 bg-red-600 rounded-full mr-1.5 status-dot"></span>
                Live
              </span>
              {onShowFullscreen && (
                <button
                  onClick={onShowFullscreen}
                  className={`text-xs px-2 py-1 border rounded smooth-transition ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600' 
                      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  title="Show fullscreen"
                >
                  ⛶
                </button>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="min-h-[400px] max-h-[500px] overflow-y-auto custom-scrollbar">
        {translationLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center">
            <svg className={`w-16 h-16 mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Waiting for audio...
            </p>
            <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Start recording to see translations
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {translationLines.map((line, index) => (
              <div
                key={line.id}
                className={`p-3 rounded-md border ${
                  isDarkMode 
                    ? 'bg-gray-900 border-gray-700' 
                    : 'bg-gray-50 border-gray-200'
                } ${index === translationLines.length - 1 ? 'new-line' : ''}`}
              >
                <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
                  {line.text}
                </p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {new Date(line.timestamp).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})