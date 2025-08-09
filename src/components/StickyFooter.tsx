import { memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface StickyFooterProps {
  isRecording: boolean
  canStart: boolean
  onStartStop: () => void
}

export const StickyFooter = memo(function StickyFooter({
  isRecording,
  canStart,
  onStartStop
}: StickyFooterProps) {
  const { isDarkMode } = useTheme()


  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t backdrop-blur-sm ${
      isDarkMode 
        ? 'bg-gray-900/95 border-gray-700' 
        : 'bg-white/95 border-gray-200'
    }`}>
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex justify-center">
          {/* Center: Action Button */}
          <button
            onClick={onStartStop}
            disabled={!canStart && !isRecording}
            className={`px-8 py-3 rounded-lg font-semibold text-base transition-all duration-200 disabled:cursor-not-allowed ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-red-500/25'
                : canStart
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-indigo-500/25 hover:scale-105'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-500 disabled:opacity-50'
                  : 'bg-gray-200 text-gray-400 disabled:opacity-50'
            }`}
          >
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
      </div>
    </div>
  )
})