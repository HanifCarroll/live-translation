# Live Translation App

A real-time speech translation desktop app built with Electron, React, and TypeScript. Translate live audio between English and Spanish with secure API key storage.

## Features

- **Real-time translation** between English ↔ Spanish
- **Dual audio input**: Microphone + system audio (with virtual audio setup)
- **Live transcription** with translation overlay
- **Secure API storage** using OS-level encryption
- **Session recordings** saved as text files
- **Dark/light theme** support
- **Fullscreen overlay** for presentations

## Quick Setup

1. **Clone and install**:
   ```bash
   git clone https://github.com/HanifCarroll/live-translation
   cd live-translation
   npm install
   ```

2. **Run the app**:
   ```bash
   npm run dev
   ```

3. **Add API keys** (Settings → API Keys tab):
   - **Deepgram API Key** - for speech-to-text
   - **Google Translate API Key** - for translation

4. **Start translating**!

## API Keys Required

### Deepgram (Speech-to-Text)
- **Get it**: https://console.deepgram.com/
- **Free tier**: 45,000 minutes/year
- **Cost**: $0.0043/minute after free tier

### Google Cloud Translate
- **Get it**: https://console.cloud.google.com/ (enable Translate API)
- **Free tier**: 500,000 characters/month  
- **Cost**: $20/1M characters after free tier

## Security

API keys are stored securely using Electron's `safeStorage`:
- **Encrypted** with your OS keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service)
- **Never stored in plain text**
- **Isolated** from settings and other data

## System Audio Setup

To translate audio from other apps (Zoom, YouTube, etc.):

**macOS**: Install [BlackHole](https://existential.audio/blackhole/)  
**Windows**: Install [VB-Cable](https://vb-audio.com/Cable/)

Then select the virtual device in Audio Input → "I have virtual audio installed"

## Build for Production

```bash
npm run build
```

## Tech Stack

- **Electron** - Desktop app framework
- **React + TypeScript** - UI framework
- **Vite** - Build tool
- **Deepgram** - Speech-to-text API
- **Google Translate** - Translation API

## License

MIT
