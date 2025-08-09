import { memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface StickyFooterProps {
  status: 'READY' | 'CONNECTING' | 'LISTENING' | 'RECONNECTING' | 'ERROR'
  isRecording: boolean
  canStart: boolean
  onStartStop: () => void
}

export const StickyFooter = memo(function StickyFooter({
  status,
  isRecording,
  canStart,
  onStartStop
}: StickyFooterProps) {
  const { isDarkMode } = useTheme()

  const getStatusConfig = () => {
    switch (status) {
      case 'READY':
        return { color: isDarkMode ? 'bg-gray-500' : 'bg-gray-400', text: 'Ready' }
      case 'CONNECTING':
        return { color: 'bg-yellow-500', text: 'Connecting' }
      case 'LISTENING':
        return { color: 'bg-green-500', text: 'Listening' }
      case 'RECONNECTING':
        return { color: 'bg-orange-500', text: 'Reconnecting' }
      case 'ERROR':
        return { color: 'bg-red-500', text: 'Error' }
      default:
        return { color: isDarkMode ? 'bg-gray-500' : 'bg-gray-400', text: 'Unknown' }
    }
  }

  const statusConfig = getStatusConfig()

  return (
    <div className={`fixed bottom-0 left-0 right-0 border-t backdrop-blur-sm ${
      isDarkMode 
        ? 'bg-gray-900/95 border-gray-700' 
        : 'bg-white/95 border-gray-200'
    }`}>
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Status */}
          <div className="flex items-center space-x-3">
            <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.color} ${isRecording ? 'pulse-dot' : ''}`}></div>
            <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              {statusConfig.text}
            </span>
            {/* Mic level bar placeholder - could add audio level visualization later */}
            {isRecording && (
              <div className="flex items-center space-x-1 ml-4">
                <div className={`w-1 h-3 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                <div className={`w-1 h-2 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                <div className={`w-1 h-4 rounded-full bg-green-500`}></div>
                <div className={`w-1 h-2 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                <div className={`w-1 h-3 rounded-full ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
              </div>
            )}
          </div>

          {/* Right: Action Button */}
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