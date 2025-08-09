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
  private pendingUtterance: string = ''
  private flushTimer: number | null = null
  private readonly QUIET_FLUSH_MS = 1500

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  // Connect to Deepgram WebSocket
  async connect(options: Record<string, any> = {}): Promise<void> {
    try {
      if (this.socket && this.isConnected) {
        return
      }

      const defaultOptions = {
        model: 'nova-2',
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        interim_results: true,          // keep interims for our buffer
        endpointing: 1200,              // require ~1.2s silence to emit a final result
        utterance_end_ms: 2000,         // close an utterance after ~2s silence
        vad_events: true,
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
      
      
      this.socket = new WebSocket(wsUrl, ['token', this.apiKey])

      return new Promise((resolve, reject) => {
        if (!this.socket) return reject(new Error('Socket not created'))

        this.socket.onopen = () => {
          this.isConnected = true
          this.reconnectAttempts = 0
          this.reconnectDelay = 1000
          
          if (this.onConnectionCallback) {
            this.onConnectionCallback('connected')
          }
          
          resolve()
        }

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data)
        }

        this.socket.onclose = (event) => {
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

      if (message.type === 'Results') {
        const result = message.channel?.alternatives?.[0]
        if (result && result.transcript) {
          if (message.is_final) {
            // accumulate finals into a single utterance
            const piece = String(result.transcript).trim()
            if (piece.length) {
              this.pendingUtterance = this.pendingUtterance
                ? `${this.pendingUtterance} ${piece}`
                : piece
            }
            // restart quiet flush timer as a fallback in case we never see UtteranceEnd
            this.restartQuietFlushTimer()
          } else {
            // ignore interims (we log them for debugging only)
            // console.log('Interim:', result.transcript)
          }
        }
      } else if (message.type === 'UtteranceEnd') {
        // primary path: flush on Deepgram's utterance boundary
        this.flushPendingUtterance()
      } else if (message.type === 'SpeechStarted' || message.type === 'Metadata') {
        // ignore
      }
    } catch (error) {
      console.error('Error parsing Deepgram message:', error, 'Raw data:', data)
    }
  }

  private flushPendingUtterance() {
    const text = this.pendingUtterance.trim()
    if (text && this.onTranscriptCallback) {
      this.onTranscriptCallback({ text, confidence: 1.0, isFinal: true })
    }
    this.pendingUtterance = ''
    if (this.flushTimer) {
      clearTimeout(this.flushTimer)
      this.flushTimer = null
    }
  }

  private restartQuietFlushTimer() {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushPendingUtterance()
    }, this.QUIET_FLUSH_MS) as unknown as number
  }

  // Send audio data to Deepgram
  sendAudio(audioData: ArrayBuffer) {
    if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(audioData)
    } else {
    }
  }

  // Start recording (begin processing audio)
  startRecording() {
    this.isRecording = true
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
    
    if (this.onConnectionCallback) {
      this.onConnectionCallback('reconnecting')
    }

    setTimeout(async () => {
      try {
        await this.connect()
        if (this.isConnected) {
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
      
      for (const [key, value] of response.headers.entries()) {
        if (key.startsWith('dg-')) {
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