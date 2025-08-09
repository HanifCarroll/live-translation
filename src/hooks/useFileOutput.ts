import { useCallback } from 'react'

interface UseFileOutputOptions {
  outputFolder: string
  sessionName: string
}

interface UseFileOutputReturn {
  createTranscriptFiles: () => Promise<void>
  appendToTranscript: (filename: string, text: string) => Promise<void>
  closeTranscriptFiles: () => Promise<void>
}

export function useFileOutput(options: UseFileOutputOptions): UseFileOutputReturn {
  const createTranscriptFiles = useCallback(async () => {
    const { outputFolder, sessionName } = options
    
    if (!outputFolder || !sessionName) {
      throw new Error('Output folder or session name not set')
    }
    
    const result = await window.electronAPI.createTranscriptFiles(outputFolder, sessionName)
    if (!result.success) {
      throw new Error(`Failed to create transcript files: ${result.error}`)
    }
  }, [options])

  const appendToTranscript = useCallback(async (filename: string, text: string) => {
    const result = await window.electronAPI.appendToTranscript(filename, text)
    if (!result.success) {
      throw new Error(`Failed to append to transcript: ${result.error}`)
    }
  }, [])

  const closeTranscriptFiles = useCallback(async () => {
    const result = await window.electronAPI.closeTranscriptFiles()
    if (!result.success) {
      throw new Error(`Failed to close transcript files: ${result.error}`)
    }
  }, [])

  return {
    createTranscriptFiles,
    appendToTranscript,
    closeTranscriptFiles
  }
}