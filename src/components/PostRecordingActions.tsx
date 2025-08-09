import { memo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

export interface TranscriptData {
  source: string
  target: string
  sessionName: string
  folderPath: string
}

interface PostRecordingActionsProps {
  transcriptData: TranscriptData
  onViewTranscripts: () => void
  onDeleteTranscripts: () => void
}

export const PostRecordingActions = memo(function PostRecordingActions({
  transcriptData,
  onViewTranscripts,
  onDeleteTranscripts
}: PostRecordingActionsProps) {
  const { isDarkMode } = useTheme()

  return (
    <div className={`mb-6 p-4 rounded-lg border ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-blue-50 border-blue-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>
            Session completed: {transcriptData.sessionName}
          </p>
          <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
            Saved to: {transcriptData.folderPath}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onViewTranscripts}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            View Transcripts
          </button>
          <button
            onClick={onDeleteTranscripts}
            className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
})