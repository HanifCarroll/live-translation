/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';
import AudioMixer from './components/AudioMixer.js';
import DeepgramClient from './components/DeepgramClient.js';
import TranslationService from './components/TranslationService.js';

// App State
const appState = {
  direction: 'en-es', // Default direction
  micDeviceId: null,
  systemDeviceId: null,
  outputFolder: null,
  sessionName: null,
  isRecording: false,
  status: 'READY'
};

// Global audio mixer, Deepgram client, and translation service instances
let audioMixer = null;
let deepgramClient = null;
let translationService = null;

// Session name generation
function generateSessionName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `session-${year}-${month}-${day}-${hours}${minutes}`;
}

function updateFilePreview() {
  const sessionName = appState.sessionName || 'session';
  const previewElement = document.getElementById('preview-names');
  
  if (previewElement) {
    previewElement.textContent = `${sessionName}-en.txt, ${sessionName}-es.txt`;
  }
}

// Direction Selector Handler
function initializeDirectionSelector() {
  const directionRadios = document.querySelectorAll('input[name="direction"]');
  
  directionRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        appState.direction = e.target.value;
        console.log('Translation direction changed to:', appState.direction);
        updateStartButtonState();
      }
    });
  });

  // Set initial direction from checked radio
  const checkedRadio = document.querySelector('input[name="direction"]:checked');
  if (checkedRadio) {
    appState.direction = checkedRadio.value;
  }
}

// Session Name Handler
function initializeSessionName() {
  const sessionInput = document.getElementById('session-name');
  
  // Generate initial session name
  const initialSessionName = generateSessionName();
  sessionInput.value = initialSessionName;
  appState.sessionName = initialSessionName;
  updateFilePreview();
  
  // Handle manual input changes
  sessionInput.addEventListener('input', (e) => {
    appState.sessionName = e.target.value.trim() || generateSessionName();
    updateFilePreview();
  });
}

// Helper function to update Start button state
function updateStartButtonState() {
  const startBtn = document.getElementById('start-stop-btn');
  
  // Enable start button only if required fields are set (system audio is now optional)
  const canStart = appState.micDeviceId && 
                   appState.outputFolder &&
                   !appState.isRecording;
  
  startBtn.disabled = !canStart;
  
  // Display inline error messages for missing fields - moved to controls section
  const controlsDiv = document.getElementById('controls');
  let errorMessage = '';
  
  if (!appState.isRecording) {
    if (!appState.micDeviceId) {
      errorMessage = 'Please select a microphone';
    } else if (!appState.outputFolder) {
      errorMessage = 'Please select output folder';
    }
  }
  
  // Show or hide error message
  let errorDiv = document.getElementById('inline-error');
  if (errorMessage) {
    if (!errorDiv) {
      errorDiv = document.createElement('div');
      errorDiv.id = 'inline-error';
      errorDiv.className = 'inline-error';
      controlsDiv.appendChild(errorDiv);
    }
    errorDiv.textContent = errorMessage;
  } else if (errorDiv) {
    errorDiv.remove();
  }
}

// Microphone Device Selector Handler
async function initializeMicrophoneSelector() {
  const micSelect = document.getElementById('mic-select');
  
  try {
    // Request microphone permission to enumerate devices
    await navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        // Stop the stream immediately, we just needed permission
        stream.getTracks().forEach(track => track.stop());
      });
    
    // Enumerate all media devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // Clear existing options except the placeholder
    micSelect.innerHTML = '<option value="">Select microphone...</option>';
    
    // Filter and add audio input devices
    const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
    
    audioInputDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${micSelect.options.length}`;
      micSelect.appendChild(option);
    });
    
    // Auto-select the first available microphone (system default)
    if (audioInputDevices.length > 0) {
      const defaultMic = audioInputDevices[0];
      micSelect.value = defaultMic.deviceId;
      appState.micDeviceId = defaultMic.deviceId;
      console.log('Auto-selected default microphone:', defaultMic.label || defaultMic.deviceId);
      updateStartButtonState();
    }
    
    // Add change event listener
    micSelect.addEventListener('change', (e) => {
      appState.micDeviceId = e.target.value || null;
      console.log('Microphone selected:', appState.micDeviceId);
      updateStartButtonState();
    });
    
    // Listen for device changes (devices plugged/unplugged)
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      console.log('Audio devices changed, refreshing list...');
      const currentValue = micSelect.value;
      await initializeMicrophoneSelector();
      // Try to restore previous selection if it still exists
      if (currentValue && Array.from(micSelect.options).some(opt => opt.value === currentValue)) {
        micSelect.value = currentValue;
        appState.micDeviceId = currentValue;
      }
      // If no previous selection or it's no longer available, auto-selection already happened in initialization
    });
    
  } catch (error) {
    console.error('Error initializing microphone selector:', error);
    micSelect.innerHTML = '<option value="">Error: Cannot access microphones</option>';
    
    // Show error message to user
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      micSelect.innerHTML = '<option value="">Permission denied - please allow microphone access</option>';
      showPermissionError('microphone');
    }
  }
}

// System Audio Device Selector Handler
async function initializeSystemAudioSelector() {
  const systemSelect = document.getElementById('system-select');
  
  try {
    // We need permission to enumerate devices (already requested in mic selector)
    const devices = await navigator.mediaDevices.enumerateDevices();
    
    // Clear existing options except the placeholder
    systemSelect.innerHTML = '<option value="">Select system audio...</option>';
    
    // Filter audio input devices - looking for BlackHole or similar virtual devices
    const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
    
    audioInputDevices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Audio Device ${systemSelect.options.length}`;
      
      // Highlight BlackHole or other virtual audio devices if found
      if (device.label) {
        const labelLower = device.label.toLowerCase();
        const highlightKeywords = ['blackhole', 'virtual', 'soundflower', 'loopback'];
        if (highlightKeywords.some(keyword => labelLower.includes(keyword))) {
          option.textContent = `⭐ ${device.label}`;
        }
      }
      
      systemSelect.appendChild(option);
    });
    
    // Auto-select system audio device with smarter logic
    if (audioInputDevices.length > 0) {
      // First, look for virtual audio devices (BlackHole, etc.)
      const virtualKeywords = ['blackhole', 'virtual', 'soundflower', 'loopback'];
      const virtualDevice = audioInputDevices.find(device => {
        if (!device.label) return false;
        const labelLower = device.label.toLowerCase();
        return virtualKeywords.some(keyword => labelLower.includes(keyword));
      });
      
      let defaultSystemDevice;
      if (virtualDevice) {
        defaultSystemDevice = virtualDevice;
        console.log('Auto-selected virtual audio device:', defaultSystemDevice.label);
      } else {
        // Look for devices that might be system audio related
        const systemAudioKeywords = ['stereo mix', 'what u hear', 'system audio', 'built-in', 'internal', 'monitor', 'loopback', 'pulse'];
        const systemAudioDevice = audioInputDevices.find(device => {
          if (!device.label) return false;
          const labelLower = device.label.toLowerCase();
          return systemAudioKeywords.some(keyword => labelLower.includes(keyword));
        });
        
        if (systemAudioDevice) {
          defaultSystemDevice = systemAudioDevice;
          console.log('Auto-selected system audio device:', defaultSystemDevice.label);
        } else if (audioInputDevices.length > 1) {
          // Use a different device than the microphone
          const micDeviceId = appState.micDeviceId;
          defaultSystemDevice = audioInputDevices.find(device => device.deviceId !== micDeviceId);
          
          if (!defaultSystemDevice) {
            // If all devices are the same as mic, use the second one anyway
            defaultSystemDevice = audioInputDevices[1];
          }
          
          console.log('Auto-selected different device for system audio:', defaultSystemDevice.label || defaultSystemDevice.deviceId);
        } else {
          // Only one device available - use it (same as mic, but no choice)
          defaultSystemDevice = audioInputDevices[0];
          console.log('Auto-selected only available device (same as mic):', defaultSystemDevice.label || defaultSystemDevice.deviceId);
        }
      }
      
      systemSelect.value = defaultSystemDevice.deviceId;
      appState.systemDeviceId = defaultSystemDevice.deviceId;
      updateStartButtonState();
    }
    
    // Add change event listener
    systemSelect.addEventListener('change', (e) => {
      appState.systemDeviceId = e.target.value || null;
      console.log('System audio device selected:', appState.systemDeviceId);
      updateStartButtonState();
    });
    
    // Listen for device changes (handled by mic selector, but we need to refresh)
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      const currentValue = systemSelect.value;
      await initializeSystemAudioSelector();
      // Try to restore previous selection if it still exists
      if (currentValue && Array.from(systemSelect.options).some(opt => opt.value === currentValue)) {
        systemSelect.value = currentValue;
        appState.systemDeviceId = currentValue;
      }
      // If no previous selection or it's no longer available, auto-selection already happened in initialization
    });
    
    // Add a help note if no BlackHole device is found
    const hasBlackHole = audioInputDevices.some(device => 
      device.label && device.label.toLowerCase().includes('blackhole')
    );
    
    if (!hasBlackHole && audioInputDevices.length > 0) {
      const helpOption = document.createElement('option');
      helpOption.value = '';
      helpOption.textContent = '── Install BlackHole for system audio ──';
      helpOption.disabled = true;
      systemSelect.appendChild(helpOption);
    }
    
  } catch (error) {
    console.error('Error initializing system audio selector:', error);
    systemSelect.innerHTML = '<option value="">Error: Cannot access audio devices</option>';
  }
}

// Output Folder Picker Handler
async function initializeFolderPicker() {
  const folderPickerBtn = document.getElementById('folder-picker-btn');
  const outputFolderInput = document.getElementById('output-folder');
  
  // Set default path to current working directory
  try {
    const result = await window.electronAPI.getCurrentDirectory();
    if (result.success) {
      outputFolderInput.value = result.path;
      appState.outputFolder = result.path;
      console.log('Default output folder set to:', result.path);
      updateStartButtonState();
    }
  } catch (error) {
    console.error('Error getting current directory:', error);
  }
  
  folderPickerBtn.addEventListener('click', async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      
      if (folderPath) {
        outputFolderInput.value = folderPath;
        appState.outputFolder = folderPath;
        console.log('Output folder selected:', folderPath);
        updateStartButtonState();
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
      outputFolderInput.value = 'Error selecting folder';
    }
  });
}

// Start/Stop Button Handler
function initializeStartStopButton() {
  const startStopBtn = document.getElementById('start-stop-btn');
  
  startStopBtn.addEventListener('click', async () => {
    if (appState.isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  });
}

// Start Recording Function
async function startRecording() {
  const startStopBtn = document.getElementById('start-stop-btn');
  
  try {
    // Update state
    appState.isRecording = true;
    startStopBtn.textContent = 'Stop';
    startStopBtn.classList.add('stop-mode');
    updateStatus('CONNECTING');
    
    // Create transcript files with session name
    const result = await window.electronAPI.createTranscriptFiles(appState.outputFolder, appState.sessionName);
    if (!result.success) {
      throw new Error(`Failed to create transcript files: ${result.error}`);
    }
    
    console.log('Recording started');
    console.log('Direction:', appState.direction);
    console.log('Mic Device:', appState.micDeviceId);
    console.log('System Device:', appState.systemDeviceId);
    console.log('Output Folder:', appState.outputFolder);
    
    // Initialize audio capture and mixing
    audioMixer = new AudioMixer();
    await audioMixer.initialize();
    
    // Connect audio streams
    await audioMixer.connectMicrophoneStream(appState.micDeviceId);
    
    // Only connect system audio if a device is selected
    if (appState.systemDeviceId) {
      console.log('Connecting system audio stream...');
      await audioMixer.connectSystemStream(appState.systemDeviceId);
    } else {
      console.log('No system audio device selected - using microphone only');
    }
    
    // Get mixed stream for processing
    const mixedStream = audioMixer.getMixedStream();
    console.log('Audio mixing setup complete, mixed stream ready');
    
    // Get API keys and validate
    const apiKeys = await window.electronAPI.getApiKeys();
    if (!apiKeys.deepgramApiKey || apiKeys.deepgramApiKey === 'your_deepgram_api_key_here') {
      throw new Error('Deepgram API key not configured. Please set DEEPGRAM_API_KEY in .env file.');
    }
    if (!apiKeys.googleApiKey || apiKeys.googleApiKey === 'your_google_api_key_here') {
      throw new Error('Google API key not configured. Please set GOOGLE_API_KEY in .env file.');
    }
    
    // Initialize services
    deepgramClient = new DeepgramClient(apiKeys.deepgramApiKey);
    translationService = new TranslationService(apiKeys.googleApiKey);
    
    // Set up Deepgram callbacks
    deepgramClient.onConnection((status) => {
      if (status === 'connected') {
        updateStatus('LISTENING');
      } else if (status === 'reconnecting') {
        updateStatus('RECONNECTING');
      } else if (status === 'disconnected') {
        // Only set error if we're still supposed to be recording
        if (appState.isRecording) {
          updateStatus('ERROR');
        }
        // If we're not recording, this was an intentional stop, so don't show error
      }
    });
    
    deepgramClient.onTranscript(async (result) => {
      console.log('Received transcript:', result.text);
      
      try {
        // Translate the text
        const translatedText = await translationService.translateForDirection(
          result.text, 
          appState.direction
        );
        
        if (translatedText) {
          // Display translation in UI
          translationDisplay.addTranslation(translatedText);
          
          // Write to transcript files
          const { source, target } = translationService.getLanguageCodes(appState.direction);
          
          // Write source text to appropriate file
          await window.electronAPI.appendToTranscript(source, result.text);
          
          // Write translated text to appropriate file  
          await window.electronAPI.appendToTranscript(target, translatedText);
          
          console.log('Translation complete and written to files');
        }
      } catch (error) {
        console.error('Translation error:', error);
        // Still display the original text if translation fails
        translationDisplay.addTranslation(`[Translation Error] ${result.text}`);
      }
    });
    
    deepgramClient.onError((error) => {
      console.error('Deepgram error:', error);
      updateStatus('ERROR');
    });
    
    // Connect to Deepgram and wait for connection
    await deepgramClient.connect();
    
    // Wait a moment to ensure WebSocket is fully connected
    await new Promise(resolve => setTimeout(resolve, 500));
    
    deepgramClient.startRecording();
    
    // Set up audio streaming to Deepgram
    audioMixer.mediaRecorder = await audioMixer.setupDeepgramStreaming(deepgramClient);
    console.log('Audio streaming to Deepgram initialized');
    
    // Test translation service
    console.log('Testing translation service...');
    await translationService.testConnection();
    console.log('Translation service ready');
    
    updateStatus('LISTENING');
    
  } catch (error) {
    console.error('Error starting recording:', error);
    updateStatus('ERROR');
    await stopRecording();
    alert(`Failed to start recording: ${error.message}`);
  }
}

// Stop Recording Function
async function stopRecording() {
  const startStopBtn = document.getElementById('start-stop-btn');
  
  try {
    // Update state FIRST to prevent disconnect from triggering error status
    appState.isRecording = false;
    startStopBtn.textContent = 'Start';
    startStopBtn.classList.remove('stop-mode');
    
    // Close WebSocket connections first (now that isRecording is false)
    if (deepgramClient) {
      deepgramClient.stop();
      deepgramClient = null;
    }
    
    // Stop audio streams
    if (audioMixer) {
      audioMixer.cleanup();
      audioMixer = null;
    }
    
    // Clear translation service
    if (translationService) {
      translationService = null;
    }
    
    // Clear translation display
    translationDisplay.clear();
    
    // Close transcript files
    await window.electronAPI.closeTranscriptFiles();
    
    updateStatus('READY');
    updateStartButtonState();
    
    console.log('Recording stopped');
    
  } catch (error) {
    console.error('Error stopping recording:', error);
    updateStatus('ERROR');
  }
}

// Translation Display Management
const translationDisplay = {
  maxLines: 3,
  currentLines: [],
  
  addTranslation(text) {
    // Add new line to the array
    this.currentLines.push(text);
    
    // Keep only the last 3 lines
    if (this.currentLines.length > this.maxLines) {
      this.currentLines.shift(); // Remove the oldest line
    }
    
    // Update the display
    this.updateDisplay();
  },
  
  updateDisplay() {
    const contentDiv = document.getElementById('translation-content');
    
    // Clear current content
    contentDiv.innerHTML = '';
    
    // Add each line as a separate div for better styling control
    this.currentLines.forEach((line, index) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'translation-line';
      lineDiv.textContent = line;
      
      // Add fade-in animation for new lines
      if (index === this.currentLines.length - 1) {
        lineDiv.classList.add('new-line');
      }
      
      contentDiv.appendChild(lineDiv);
    });
    
    // Auto-scroll to bottom to show newest content
    contentDiv.scrollTop = contentDiv.scrollHeight;
  },
  
  clear() {
    this.currentLines = [];
    this.updateDisplay();
  }
};

// Update Status (simplified - no visual display)
function updateStatus(status) {
  appState.status = status;
  console.log('Status updated to:', status);
}

// Show permission error with button to open system settings
function showPermissionError(deviceType) {
  const controlsDiv = document.getElementById('controls');
  let errorDiv = document.getElementById('permission-error');
  
  if (!errorDiv) {
    errorDiv = document.createElement('div');
    errorDiv.id = 'permission-error';
    errorDiv.className = 'permission-error';
    
    const message = document.createElement('p');
    message.textContent = `${deviceType === 'microphone' ? 'Microphone' : 'Audio'} access denied. Please allow access in System Settings.`;
    
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = 'Open System Settings';
    settingsBtn.className = 'settings-button';
    settingsBtn.onclick = openSystemSettings;
    
    errorDiv.appendChild(message);
    errorDiv.appendChild(settingsBtn);
    controlsDiv.appendChild(errorDiv);
  }
}

// Open system settings for permissions
async function openSystemSettings() {
  try {
    // Use Electron shell to open system preferences
    await window.electronAPI.openSystemSettings();
  } catch (error) {
    console.error('Error opening system settings:', error);
    // Fallback: show instructions
    alert('Please open System Preferences > Security & Privacy > Privacy > Microphone and allow access for this application.');
  }
}

// Initialize Advanced Options Toggle
function initializeAdvancedToggle() {
  const advancedToggle = document.getElementById('advanced-toggle');
  const advancedSection = document.getElementById('advanced-section');
  let isExpanded = false;

  advancedToggle.addEventListener('click', () => {
    isExpanded = !isExpanded;
    
    if (isExpanded) {
      advancedSection.style.display = 'block';
      advancedToggle.textContent = 'Hide virtual audio options';
    } else {
      advancedSection.style.display = 'none';
      advancedToggle.textContent = 'I have virtual audio software';
    }
  });
}

// Initialize External Links
function initializeExternalLinks() {
  const blackholeLink = document.getElementById('blackhole-link');
  const vbCableLink = document.getElementById('vb-cable-link');
  const pulseAudioLink = document.getElementById('pulseaudio-link');
  
  blackholeLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await window.electronAPI.openExternalUrl('https://existential.audio/blackhole/');
    } catch (error) {
      console.error('Error opening BlackHole link:', error);
    }
  });
  
  vbCableLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await window.electronAPI.openExternalUrl('https://vb-audio.com/Cable/');
    } catch (error) {
      console.error('Error opening VB-Cable link:', error);
    }
  });
  
  pulseAudioLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      await window.electronAPI.openExternalUrl('https://wiki.archlinux.org/title/PulseAudio/Examples#Monitor_specific_output');
    } catch (error) {
      console.error('Error opening PulseAudio link:', error);
    }
  });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Live Translator initialized');
  initializeDirectionSelector();
  await initializeMicrophoneSelector();
  await initializeSystemAudioSelector();
  await initializeFolderPicker();
  initializeSessionName();
  initializeStartStopButton();
  initializeAdvancedToggle();
  initializeExternalLinks();
  updateStartButtonState();
  updateStatus('READY');
});

// Export for use in other modules
window.appState = appState;
window.translationDisplay = translationDisplay;
