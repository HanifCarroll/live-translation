import { memo, useEffect, useState } from 'react'

interface CountdownOverlayProps {
  isVisible: boolean
  onComplete: () => void
}

export const CountdownOverlay = memo(function CountdownOverlay({
  isVisible,
  onComplete
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

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-40 flex items-center justify-center">
      <div className="text-center">
        <div className="text-8xl font-bold text-white mb-4 animate-pulse">
          {count > 0 ? count : 'GO!'}
        </div>
        <p className="text-2xl text-gray-300">
          {count > 0 ? 'Starting in...' : 'Recording started!'}
        </p>
      </div>
    </div>
  )
})