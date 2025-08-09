import { memo } from 'react'
import { TranslationLine } from './TranslationDisplay'

interface RecordingOverlayProps {
  isVisible: boolean
  translationLines: TranslationLine[]
  onClose: () => void
}

export const RecordingOverlay = memo(function RecordingOverlay({
  isVisible,
  translationLines,
  onClose
}: RecordingOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
      <div className="max-w-4xl w-full mx-auto p-8">
        <button
          onClick={onClose}
          className="absolute top-8 right-8 text-white hover:text-gray-300 transition-colors"
          aria-label="Close fullscreen"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-8">Live Translation</h2>
          <div className="space-y-6">
            {translationLines.length === 0 ? (
              <p className="text-gray-400 text-xl">Listening...</p>
            ) : (
              translationLines.map((line, index) => (
                <div
                  key={line.id}
                  className={`text-white ${
                    index === translationLines.length - 1 
                      ? 'text-4xl font-medium new-line' 
                      : 'text-2xl opacity-60'
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