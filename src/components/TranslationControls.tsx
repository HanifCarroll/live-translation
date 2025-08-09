import { memo } from 'react'
import { TranslationDirection } from './TranslationService'
import { useTheme } from '../contexts/ThemeContext'

interface TranslationControlsProps {
  direction: TranslationDirection
  onDirectionChange: (direction: TranslationDirection) => void
  disabled?: boolean
}

export const TranslationControls = memo(function TranslationControls({
  direction,
  onDirectionChange,
  disabled = false
}: TranslationControlsProps) {
  const { isDarkMode } = useTheme()

  return (
    <div className={`rounded-lg border p-6 card-hover-no-lift ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
      <h3 className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
        Translation Direction
      </h3>
      <div className="flex space-x-3">
        <button
          onClick={() => onDirectionChange('en-es')}
          disabled={disabled}
          className={`flex-1 py-2.5 px-4 rounded-md border text-sm font-medium smooth-transition disabled:opacity-50 disabled:cursor-not-allowed ${
            direction === 'en-es'
              ? 'bg-indigo-600 text-white border-indigo-600'
              : isDarkMode 
                ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          English → Spanish
        </button>
        <button
          onClick={() => onDirectionChange('es-en')}
          disabled={disabled}
          className={`flex-1 py-2.5 px-4 rounded-md border text-sm font-medium smooth-transition disabled:opacity-50 disabled:cursor-not-allowed ${
            direction === 'es-en'
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
  )
})