import { useRef, useCallback, useEffect } from 'react'
import { TranslationService, TranslationDirection } from '../components/TranslationService'

interface UseTranslationOptions {
  apiKey: string
}

interface UseTranslationReturn {
  initialize: () => void
  translateForDirection: (text: string, direction: TranslationDirection) => Promise<string | null>
  testConnection: () => Promise<void>
  getLanguageCodes: (direction: TranslationDirection) => { source: string; target: string }
  translationService: TranslationService | null
}

export function useTranslation(options: UseTranslationOptions): UseTranslationReturn {
  const translationServiceRef = useRef<TranslationService | null>(null)

  const initialize = useCallback(() => {
    const { apiKey } = options
    translationServiceRef.current = new TranslationService(apiKey)
  }, [options])

  const translateForDirection = useCallback(async (text: string, direction: TranslationDirection) => {
    if (!translationServiceRef.current) {
      throw new Error('Translation service not initialized')
    }
    return translationServiceRef.current.translateForDirection(text, direction)
  }, [])

  const testConnection = useCallback(async () => {
    if (!translationServiceRef.current) {
      throw new Error('Translation service not initialized')
    }
    return translationServiceRef.current.testConnection()
  }, [])

  const getLanguageCodes = useCallback((direction: TranslationDirection) => {
    if (!translationServiceRef.current) {
      throw new Error('Translation service not initialized')
    }
    return translationServiceRef.current.getLanguageCodes(direction)
  }, [])

  const cleanup = useCallback(() => {
    translationServiceRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [cleanup])

  return {
    initialize,
    translateForDirection,
    testConnection,
    getLanguageCodes,
    translationService: translationServiceRef.current
  }
}