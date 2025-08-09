// DeepgramClient.ts - WebSocket client for Deepgram STT

export interface TranscriptResult {
  text: string
  confidence: number
  isFinal: boolean
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting'

export class DeepgramClient {
  private apiKey: string
  private socket: WebSocket | null = null
  private isConnected: boolean = false
  private isRecording: boolean = false
  private onTranscriptCallback: ((result: TranscriptResult) => void) | null = null
  private onErrorCallback: ((error: any) => void) | null = null
  private onConnectionCallback: ((status: ConnectionStatus) => void) | null = null
  private reconnectAttempts: number = 0
  private maxReconnectAttempts: number = 2
  private reconnectDelay: number = 1000 // Start with 1 second

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // Connect to Deepgram WebSocket
  async connect(options: Record<string, any> = {}): Promise<void> {
    try {
      if (this.socket && this.isConnected) {
        console.log('Already connected to Deepgram')
        return
      }

      const defaultOptions = {
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: true, // Enable interim results for better responsiveness
        endpointing: 300, // Send final results after 300ms of silence
        utterance_end_ms: 1000, // Complete utterance after 1 second of silence
        vad_events: true, // Enable voice activity detection events
        // Remove encoding/sample_rate for compressed audio formats
        // Deepgram will auto-detect the format
      }

      const config = { ...defaultOptions, ...options }
      const params = new URLSearchParams()
      
      // Convert config object to URLSearchParams
      Object.entries(config).forEach(([key, value]) => {
        params.append(key, String(value))
      })
      
      const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`
      
      console.log('Connecting to Deepgram WebSocket...')
      console.log('WebSocket URL:', wsUrl)
      console.log('API Key (first 10 chars):', this.apiKey.substring(0, 10) + '...')
      
      this.socket = new WebSocket(wsUrl, ['token', this.apiKey])

      return new Promise((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket not created'))

        this.socket.onopen = () => {
          console.log('Connected to Deepgram')
          this.isConnected = true
          this.reconnectAttempts = 0
          this.reconnectDelay = 1000
          
          if (this.onConnectionCallback) {
            this.onConnectionCallback('connected')
          }
          
          resolve()
        }

        this.socket.onmessage = (event) => {
          console.log('Raw message from Deepgram:', event.data)
          this.handleMessage(event.data)
        }

        this.socket.onclose = (event) => {
          console.log('Deepgram connection closed:', event.code, event.reason)
          this.isConnected = false
          
          if (this.onConnectionCallback) {
            this.onConnectionCallback('disconnected')
          }
          
          // Attempt reconnection if unexpected closure
          if (event.code !== 1000 && this.isRecording) {
            this.attemptReconnection()
          }
        }

        this.socket.onerror = (error) => {
          console.error('Deepgram WebSocket error:', error)
          console.error('WebSocket readyState:', this.socket?.readyState)
          console.error('WebSocket URL:', this.socket?.url)
          this.isConnected = false
          
          if (this.onErrorCallback) {
            this.onErrorCallback(error)
          }
          
          reject(error)
        }
      })
    } catch (error) {
      console.error('Failed to connect to Deepgram:', error)
      throw error
    }
  }

  // Handle incoming messages from Deepgram
  private handleMessage(data: string) {
    try {
      const message = JSON.parse(data)
      console.log('Parsed Deepgram message:', message)
      
      if (message.type === 'Results') {
        const result = message.channel?.alternatives?.[0]
        
        if (result && result.transcript) {
          if (message.is_final) {
            console.log('Final transcript:', result.transcript)
            
            if (this.onTranscriptCallback) {
              this.onTranscriptCallback({
                text: result.transcript,
                confidence: result.confidence,
                isFinal: true
              })
            }
          } else {
            // Log interim results for debugging but don't process them
            console.log('Interim transcript:', result.transcript)
          }
        } else {
          console.log('Results message with no transcript:', message)
        }
      } else if (message.type === 'Metadata') {
        console.log('Deepgram metadata:', message)
      } else if (message.type === 'SpeechStarted') {
        console.log('Speech started')
      } else if (message.type === 'UtteranceEnd') {
        console.log('Utterance ended')
      } else {
        console.log('Unknown message type:', message.type, message)
      }
    } catch (error) {
      console.error('Error parsing Deepgram message:', error, 'Raw data:', data)
    }
  }

  // Send audio data to Deepgram
  sendAudio(audioData: ArrayBuffer) {
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      console.log('Sending audio to Deepgram:', audioData.byteLength, 'bytes')
      this.socket.send(audioData)
    } else {
      console.warn('Cannot send audio: WebSocket not connected. State:', this.socket?.readyState, 'Connected:', this.isConnected)
    }
  }

  // Start recording (begin processing audio)
  startRecording() {
    this.isRecording = true
    console.log('Deepgram recording started')
  }

  // Stop recording and close connection
  stop() {
    this.isRecording = false
    
    if (this.socket && this.isConnected) {
      // Send close frame to indicate end of audio stream
      this.socket.send(JSON.stringify({ type: 'CloseStream' }))
      
      // Close WebSocket connection
      this.socket.close(1000, 'Recording stopped')
      this.socket = null
      this.isConnected = false
    }
    
    console.log('Deepgram connection stopped')
  }

  // Attempt to reconnect with exponential backoff
  private async attemptReconnection() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      if (this.onErrorCallback) {
        this.onErrorCallback(new Error('Failed to reconnect to Deepgram'))
      }
      return
    }

    this.reconnectAttempts++
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
    
    if (this.onConnectionCallback) {
      this.onConnectionCallback('reconnecting')
    }

    setTimeout(async () => {
      try {
        await this.connect()
        if (this.isConnected) {
          console.log('Reconnection successful')
        }
      } catch (error) {
        console.error('Reconnection failed:', error)
        // Double the delay for next attempt (exponential backoff)
        this.reconnectDelay *= 2
        this.attemptReconnection()
      }
    }, this.reconnectDelay)
  }

  // Set callback for transcript results
  onTranscript(callback: (result: TranscriptResult) => void) {
    this.onTranscriptCallback = callback
  }

  // Set callback for errors
  onError(callback: (error: any) => void) {
    this.onErrorCallback = callback
  }

  // Set callback for connection status changes
  onConnection(callback: (status: ConnectionStatus) => void) {
    this.onConnectionCallback = callback
  }

  // Test connection with HTTP request to get debug headers
  async testConnection() {
    try {
      const response = await fetch('https://api.deepgram.com/v1/listen', {
        method: 'HEAD',
        headers: {
          'Authorization': `Token ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      console.log('Deepgram API test response status:', response.status)
      console.log('Response headers:')
      for (const [key, value] of response.headers.entries()) {
        if (key.startsWith('dg-')) {
          console.log(`${key}: ${value}`)
        }
      }
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Deepgram API error:', errorText)
        throw new Error(`Deepgram API returned ${response.status}: ${errorText}`)
      }
    } catch (error) {
      console.error('Error testing Deepgram connection:', error)
      throw error
    }
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      isRecording: this.isRecording,
      reconnectAttempts: this.reconnectAttempts,
      socketState: this.socket?.readyState
    }
  }
}