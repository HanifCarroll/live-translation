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

// App State
const appState = {
  direction: 'en-es', // Default direction
  micDeviceId: null,
  systemDeviceId: null,
  outputFolder: null,
  isRecording: false,
  status: 'READY'
};

// Global audio mixer instance
let audioMixer = null;

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

// Helper function to update Start button state
function updateStartButtonState() {
  const startBtn = document.getElementById('start-stop-btn');
  
  // Enable start button only if all required fields are set
  const canStart = appState.micDeviceId && 
                   appState.systemDeviceId && 
                   appState.outputFolder &&
                   !appState.isRecording;
  
  startBtn.disabled = !canStart;
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
    });
    
  } catch (error) {
    console.error('Error initializing microphone selector:', error);
    micSelect.innerHTML = '<option value="">Error: Cannot access microphones</option>';
    
    // Show error message to user
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      micSelect.innerHTML = '<option value="">Permission denied - please allow microphone access</option>';
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
      if (device.label && (
        device.label.toLowerCase().includes('blackhole') ||
        device.label.toLowerCase().includes('virtual') ||
        device.label.toLowerCase().includes('soundflower') ||
        device.label.toLowerCase().includes('loopback')
      )) {
        option.textContent = `⭐ ${device.label}`;
      }
      
      systemSelect.appendChild(option);
    });
    
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
function initializeFolderPicker() {
  const folderPickerBtn = document.getElementById('folder-picker-btn');
  const outputFolderInput = document.getElementById('output-folder');
  
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
    
    // Create transcript files
    const result = await window.electronAPI.createTranscriptFiles(appState.outputFolder);
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
    await audioMixer.connectSystemStream(appState.systemDeviceId);
    
    // Get mixed stream for processing
    const mixedStream = audioMixer.getMixedStream();
    console.log('Audio mixing setup complete, mixed stream ready');
    
    // TODO: Connect to Deepgram with mixedStream
    // TODO: Start translation service
    
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
    // Update state
    appState.isRecording = false;
    startStopBtn.textContent = 'Start';
    startStopBtn.classList.remove('stop-mode');
    
    // Stop audio streams
    if (audioMixer) {
      audioMixer.cleanup();
      audioMixer = null;
    }
    
    // TODO: Close WebSocket connections
    
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

// Update Status Display
function updateStatus(status) {
  appState.status = status;
  const statusChip = document.getElementById('status-chip');
  
  // Remove all status classes
  statusChip.className = 'status-chip';
  
  // Add appropriate status class
  switch(status) {
    case 'READY':
      statusChip.classList.add('status-ready');
      statusChip.textContent = 'READY';
      break;
    case 'CONNECTING':
      statusChip.classList.add('status-connecting');
      statusChip.textContent = 'CONNECTING';
      break;
    case 'LISTENING':
      statusChip.classList.add('status-listening');
      statusChip.textContent = 'LISTENING';
      break;
    case 'RECONNECTING':
      statusChip.classList.add('status-reconnecting');
      statusChip.textContent = 'RECONNECTING';
      break;
    case 'ERROR':
      statusChip.classList.add('status-error');
      statusChip.textContent = 'ERROR';
      break;
    default:
      statusChip.textContent = status;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Live Translator initialized');
  initializeDirectionSelector();
  await initializeMicrophoneSelector();
  await initializeSystemAudioSelector();
  initializeFolderPicker();
  initializeStartStopButton();
  updateStartButtonState();
  updateStatus('READY');
});

// Export for use in other modules
window.appState = appState;
window.translationDisplay = translationDisplay;
