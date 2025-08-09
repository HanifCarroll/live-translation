import { memo, useEffect, useState } from 'react'

interface CountdownOverlayProps {
  isVisible: boolean
  onComplete: () => void
  onCancel?: () => void
}

export const CountdownOverlay = memo(function CountdownOverlay({
  isVisible,
  onComplete,
  onCancel
}: CountdownOverlayProps) {
  const [count, setCount] = useState(3)

  useEffect(() => {
    if (!isVisible) {
      setCount(3)
      return
    }

    if (count === 0) {
      onComplete()
      return
    }

    const timer = setTimeout(() => {
      setCount(prev => prev - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [isVisible, count, onComplete])

  // Handle Escape key to cancel countdown
  useEffect(() => {
    if (!isVisible || !onCancel) return

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [isVisible, onCancel])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-40 flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl font-bold text-white mb-4 animate-pulse">
          {count > 0 ? count : 'GO!'}
        </div>
        <p className="text-2xl text-gray-300 mb-6">
          {count > 0 ? 'Starting in...' : 'Recording started!'}
        </p>
        {count > 0 && onCancel && (
          <div className="space-y-2">
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <p className="text-sm text-gray-400">
              Press Escape to cancel
            </p>
          </div>
        )}
      </div>
    </div>
  )
})