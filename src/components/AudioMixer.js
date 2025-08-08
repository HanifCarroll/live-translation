// AudioMixer.js - Audio mixing logic using Web Audio API

class AudioMixer {
  constructor() {
    this.audioContext = null;
    this.micSourceNode = null;
    this.systemSourceNode = null;
    this.micGainNode = null;
    this.systemGainNode = null;
    this.destinationNode = null;
    this.mixedStream = null;
    this.micStream = null;
    this.systemStream = null;
    this.mediaRecorder = null;
  }

  // Initialize the audio context and graph
  async initialize() {
    try {
      // Create AudioContext
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Resume context if it's suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create destination node for mixed output
      this.destinationNode = this.audioContext.createMediaStreamDestination();
      
      // Create gain nodes for volume control
      this.micGainNode = this.audioContext.createGain();
      this.systemGainNode = this.audioContext.createGain();
      
      // Set initial gain levels (can be adjusted later)
      this.micGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      this.systemGainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      
      console.log('AudioMixer initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize AudioMixer:', error);
      throw error;
    }
  }

  // Connect microphone stream to the audio graph
  async connectMicrophoneStream(deviceId) {
    try {
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }

      // Get microphone stream
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000 // Optimal for Deepgram
        }
      });

      // Create source node from microphone stream
      this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      
      // Connect mic -> gain -> destination
      this.micSourceNode.connect(this.micGainNode);
      this.micGainNode.connect(this.destinationNode);
      
      console.log('Microphone stream connected');
      return true;
    } catch (error) {
      console.error('Failed to connect microphone stream:', error);
      throw error;
    }
  }

  // Connect system audio stream to the audio graph
  async connectSystemStream(deviceId) {
    try {
      if (!this.audioContext) {
        throw new Error('AudioContext not initialized');
      }

      // Get system audio stream (BlackHole or similar)
      this.systemStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 16000 // Optimal for Deepgram
        }
      });

      // Create source node from system stream
      this.systemSourceNode = this.audioContext.createMediaStreamSource(this.systemStream);
      
      // Connect system -> gain -> destination
      this.systemSourceNode.connect(this.systemGainNode);
      this.systemGainNode.connect(this.destinationNode);
      
      console.log('System audio stream connected');
      return true;
    } catch (error) {
      console.error('Failed to connect system audio stream:', error);
      throw error;
    }
  }

  // Get the mixed audio stream for processing
  getMixedStream() {
    if (!this.destinationNode) {
      throw new Error('Audio graph not initialized');
    }
    
    this.mixedStream = this.destinationNode.stream;
    return this.mixedStream;
  }

  // Set up audio streaming to Deepgram with PCM encoding
  async setupDeepgramStreaming(deepgramClient) {
    if (!this.mixedStream) {
      throw new Error('Mixed stream not available');
    }

    // Try different MIME types - PCM is rarely supported in browsers
    const supportedTypes = [
      'audio/webm;codecs=pcm',
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus'
    ];
    
    let selectedType = null;
    for (const type of supportedTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedType = type;
        console.log('Using MIME type:', selectedType);
        break;
      }
    }
    
    if (!selectedType) {
      throw new Error('No supported audio codec found');
    }

    // Create MediaRecorder with the best available codec
    let mediaRecorder = new MediaRecorder(this.mixedStream, { mimeType: selectedType });
    
    // Note: Deepgram expects linear16 PCM, but we're sending compressed audio
    // This might require format conversion or different Deepgram parameters

    // Set up data handling
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && deepgramClient && deepgramClient.isConnected) {
        console.log('Audio data available:', event.data.size, 'bytes');
        // Convert blob to ArrayBuffer for Deepgram
        event.data.arrayBuffer().then(buffer => {
          console.log('Sending audio buffer to Deepgram:', buffer.byteLength, 'bytes');
          deepgramClient.sendAudio(buffer);
        });
      } else {
        console.log('Skipping audio data - size:', event.data.size, 'connected:', deepgramClient?.isConnected);
      }
    };

    mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
    };

    // Start recording with small time slices for real-time streaming
    mediaRecorder.start(100); // 100ms chunks for low latency
    
    console.log('MediaRecorder started with format:', selectedType);
    console.log('MediaRecorder state:', mediaRecorder.state);
    
    return mediaRecorder;
  }

  // Set microphone volume (0.0 to 1.0)
  setMicrophoneVolume(volume) {
    if (this.micGainNode) {
      this.micGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  // Set system audio volume (0.0 to 1.0)
  setSystemVolume(volume) {
    if (this.systemGainNode) {
      this.systemGainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }

  // Cleanup and disconnect all streams
  cleanup() {
    try {
      // Stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
        this.mediaRecorder = null;
      }

      // Disconnect nodes
      if (this.micSourceNode) {
        this.micSourceNode.disconnect();
        this.micSourceNode = null;
      }
      
      if (this.systemSourceNode) {
        this.systemSourceNode.disconnect();
        this.systemSourceNode = null;
      }
      
      if (this.micGainNode) {
        this.micGainNode.disconnect();
        this.micGainNode = null;
      }
      
      if (this.systemGainNode) {
        this.systemGainNode.disconnect();
        this.systemGainNode = null;
      }

      // Stop media streams
      if (this.micStream) {
        this.micStream.getTracks().forEach(track => track.stop());
        this.micStream = null;
      }
      
      if (this.systemStream) {
        this.systemStream.getTracks().forEach(track => track.stop());
        this.systemStream = null;
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.destinationNode = null;
      this.mixedStream = null;
      
      console.log('AudioMixer cleanup completed');
    } catch (error) {
      console.error('Error during AudioMixer cleanup:', error);
    }
  }

  // Get current audio context state
  getState() {
    return {
      contextState: this.audioContext?.state,
      hasMicStream: !!this.micStream,
      hasSystemStream: !!this.systemStream,
      hasMixedStream: !!this.mixedStream
    };
  }
}

export default AudioMixer;