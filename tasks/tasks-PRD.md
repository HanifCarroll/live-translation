## Relevant Files

- `src/main.js` - Main Electron process, needs IPC handlers for file operations and API key access (modified)
- `src/preload.js` - Preload script for secure IPC communication between main and renderer (modified)
- `src/renderer.js` - Renderer process entry point, will handle UI and audio processing (modified)
- `src/index.html` - Main HTML structure for the application UI (modified)
- `src/components/AudioMixer.js` - Audio mixing logic using Web Audio API (created)
- `src/components/DeepgramClient.js` - WebSocket client for Deepgram STT
- `src/components/TranslationService.js` - Google Translate API integration
- `src/components/TranscriptManager.js` - File writing and session management
- `src/index.css` - Application styling (modified)
- `.env` - Environment variables for API keys
- `package.json` - Dependencies and scripts configuration

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.js` and `MyComponent.test.js` in the same directory).
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [x] 1.0 Set up project dependencies and environment configuration
  - [x] 1.1 Install required npm packages (dotenv, @deepgram/sdk, @google-cloud/translate or googleapis)
  - [x] 1.2 Create .env file with DEEPGRAM_API_KEY and GOOGLE_API_KEY placeholders
  - [x] 1.3 Add .env to .gitignore to prevent API key exposure
  - [x] 1.4 Configure webpack to handle environment variables properly
  - [x] 1.5 Update package.json scripts for dev and build commands
  - [x] 1.6 Set up TypeScript configuration if needed for better type safety (skipped - using JS)

- [x] 2.0 Implement core UI structure and controls
  - [x] 2.1 Create HTML structure with top bar controls section
  - [x] 2.2 Add direction selector (EN→ES / ES→EN radio buttons)
  - [x] 2.3 Implement microphone device dropdown selector
  - [x] 2.4 Implement system audio device dropdown selector (for BlackHole)
  - [x] 2.5 Add output folder picker with Electron dialog
  - [x] 2.6 Create Start/Stop button with state management
  - [x] 2.7 Add status chip component showing connection states
  - [x] 2.8 Create translation overlay panel (3-line rolling display)
  - [x] 2.9 Style the application with clean, readable CSS

- [ ] 3.0 Build audio capture and mixing system
  - [x] 3.1 Request microphone permissions and enumerate audio devices
  - [x] 3.2 Implement device selection logic for mic and system audio
  - [x] 3.3 Create AudioContext and set up audio graph
  - [x] 3.4 Capture mic stream using getUserMedia with selected deviceId
  - [x] 3.5 Capture system audio stream (BlackHole device) with getUserMedia
  - [x] 3.6 Create MediaStreamAudioSourceNodes for both streams
  - [x] 3.7 Set up GainNodes for volume control (if needed)
  - [x] 3.8 Connect both sources to MediaStreamAudioDestinationNode
  - [x] 3.9 Extract mixed stream for Deepgram processing
  - [x] 3.10 Implement stream cleanup on stop

- [ ] 4.0 Integrate Deepgram real-time STT service
  - [ ] 4.1 Create Deepgram WebSocket client module
  - [ ] 4.2 Configure connection with API key from environment
  - [ ] 4.3 Set up real-time streaming parameters (smart punctuation enabled)
  - [ ] 4.4 Implement PCM audio encoding from mixed stream
  - [ ] 4.5 Stream audio data to Deepgram WebSocket
  - [ ] 4.6 Handle incoming transcript messages
  - [ ] 4.7 Filter for final transcripts only (is_final === true)
  - [ ] 4.8 Parse and extract text from Deepgram responses
  - [ ] 4.9 Implement WebSocket reconnection logic
  - [ ] 4.10 Handle WebSocket errors and connection drops

- [ ] 5.0 Integrate Google Translate API
  - [ ] 5.1 Create translation service module
  - [ ] 5.2 Set up Google Translate v2 REST API client
  - [ ] 5.3 Configure API key authentication
  - [ ] 5.4 Implement translate function with source/target language params
  - [ ] 5.5 Handle API rate limiting and errors
  - [ ] 5.6 Map language direction to proper source/target codes
  - [ ] 5.7 Process finalized STT text through translation
  - [ ] 5.8 Return translated text to UI layer

- [ ] 6.0 Implement transcript file management
  - [ ] 6.1 Set up IPC communication between renderer and main process
  - [ ] 6.2 Create IPC handlers in main process for file operations
  - [ ] 6.3 Implement session-based file creation on Start
  - [ ] 6.4 Create transcript-en.txt and transcript-es.txt files
  - [ ] 6.5 Ensure files are truncated/overwritten at session start
  - [ ] 6.6 Implement append operations for source text
  - [ ] 6.7 Implement append operations for translated text
  - [ ] 6.8 Handle proper line endings and UTF-8 encoding
  - [ ] 6.9 Flush and close file handles on Stop
  - [ ] 6.10 Validate output folder exists and is writable

- [ ] 7.0 Add error handling and status management
  - [ ] 7.1 Create status state machine (READY, CONNECTING, LISTENING, RECONNECTING, ERROR)
  - [ ] 7.2 Display inline error messages for missing devices
  - [ ] 7.3 Handle missing API keys with clear user messaging
  - [ ] 7.4 Implement network error detection and retry logic (2 retries max)
  - [ ] 7.5 Add exponential backoff for reconnection attempts
  - [ ] 7.6 Handle microphone permission denied errors
  - [ ] 7.7 Add "Open System Settings" button for permission issues
  - [ ] 7.8 Implement graceful shutdown on errors
  - [ ] 7.9 Add basic logging for debugging (console only)
  - [ ] 7.10 Ensure all async operations have proper error boundaries