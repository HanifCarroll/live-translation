// TranslationService.ts - Google Translate API integration

export type TranslationDirection = 'en-es' | 'es-en'

export interface LanguageCodes {
  source: string
  target: string
}

export class TranslationService {
  private apiKey: string
  private baseUrl: string = 'https://translation.googleapis.com/language/translate/v2'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // Translate text using Google Translate v2 API
  async translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string | null> {
    try {
      const clean = text.replace(/\s+/g, ' ').trim()
      if (!clean) return ''
      
      if (!clean || clean.length === 0) {
        return null
      }

      // Build URL with API key as query parameter
      const url = new URL(this.baseUrl)
      url.searchParams.append('key', this.apiKey)

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: clean,
          source: sourceLanguage,
          target: targetLanguage,
          format: 'text'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Google Translate API error:', response.status, errorText)
        throw new Error(`Translation failed: ${response.status} ${errorText}`)
      }

      const result = await response.json()
      
      if (result.data && result.data.translations && result.data.translations.length > 0) {
        const translatedText = result.data.translations[0].translatedText
        return translatedText
      } else {
        console.error('Unexpected translation response format:', result)
        throw new Error('Invalid translation response format')
      }
    } catch (error) {
      console.error('Translation error:', error)
      throw error
    }
  }

  // Map direction strings to language codes
  getLanguageCodes(direction: TranslationDirection): LanguageCodes {
    switch (direction) {
      case 'en-es':
        return { source: 'en', target: 'es' }
      case 'es-en':
        return { source: 'es', target: 'en' }
      default:
        throw new Error(`Unknown direction: ${direction}`)
    }
  }

  // Translate based on app direction setting
  async translateForDirection(text: string, direction: TranslationDirection): Promise<string | null> {
    const { source, target } = this.getLanguageCodes(direction)
    return await this.translateText(text, source, target)
  }

  // Test the API connection
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.translateText('Hello', 'en', 'es')
      return true
    } catch (error) {
      console.error('Translation service test failed:', error)
      throw error
    }
  }
}