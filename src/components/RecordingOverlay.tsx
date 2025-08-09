import { memo } from 'react'
import { TranslationLine } from './TranslationDisplay'

interface RecordingOverlayProps {
  isVisible: boolean
  translationLines: TranslationLine[]
  onStop: () => void
}

export const RecordingOverlay = memo(function RecordingOverlay({
  isVisible,
  translationLines,
  onStop
}: RecordingOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header with title and stop button */}
      <div className="flex items-center justify-between p-8">
        <h2 className="text-3xl font-bold text-white">Live Translation</h2>
        <button
          onClick={onStop}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          Stop Recording
        </button>
      </div>
      
      {/* Translation content */}
      <div className="flex-1 flex items-center justify-center px-8 pb-16">
        <div className="max-w-4xl w-full text-center">
          <div className="space-y-6">
            {translationLines.length === 0 ? (
              <p className="text-gray-400 text-xl">Listening...</p>
            ) : (
              translationLines.map((line, index) => (
                <div
                  key={line.id}
                  className={`text-white ${
                    index === translationLines.length - 1 
                      ? 'text-5xl font-medium new-line' 
                      : 'text-3xl opacity-60'
                  }`}
                >
                  {line.text}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
})