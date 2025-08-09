import { useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";
import { TranslationDirection } from "./components/TranslationService";
import Settings from "./components/Settings";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { useAudioDevices } from "./hooks/useAudioDevices";
import { useSettings } from "./hooks/useSettings";
import { useRecording, TranslationLine } from "./hooks/useRecording";
import { RecordingOverlay } from "./components/RecordingOverlay";
import {
  PostRecordingActions,
  TranscriptData,
} from "./components/PostRecordingActions";
import { CountdownOverlay } from "./components/CountdownOverlay";
import { SessionSetup } from "./components/SessionSetup";
import { StickyFooter } from "./components/StickyFooter";
import toast, { Toaster } from "react-hot-toast";

// Type declarations for Electron API
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      createTranscriptFiles: (
        folderPath: string,
        sessionName: string
      ) => Promise<{ success: boolean; folderPath?: string; error?: string }>;
      appendToTranscript: (
        filename: string,
        text: string
      ) => Promise<{ success: boolean; error?: string }>;
      closeTranscriptFiles: () => Promise<{ success: boolean; error?: string }>;
      getApiKeys: () => Promise<{
        deepgramApiKey: string;
        googleApiKey: string;
      }>;
      openSystemSettings: () => Promise<{ success: boolean; error?: string }>;
      getCurrentDirectory: () => Promise<{
        success: boolean;
        path?: string;
        error?: string;
      }>;
      openExternalUrl: (
        url: string
      ) => Promise<{ success: boolean; error?: string }>;
      readTranscriptFile: (
        filepath: string
      ) => Promise<{ success: boolean; content?: string; error?: string }>;
      deleteTranscriptFile: (
        filepath: string
      ) => Promise<{ success: boolean; error?: string }>;
      getSettings: () => Promise<{
        success: boolean;
        settings?: any;
        error?: string;
      }>;
      updateSettings: (
        settings: any
      ) => Promise<{ success: boolean; settings?: any; error?: string }>;
    };
  }
}

interface AppState {
  direction: TranslationDirection;
  micDeviceId: string | null;
  systemDeviceId: string | null;
  outputFolder: string | null;
  sessionName: string | null;
  isRecording: boolean;
  status: "READY" | "CONNECTING" | "LISTENING" | "RECONNECTING" | "ERROR";
}

function AppContent() {
  const { isDarkMode, setTheme } = useTheme();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const { micDevices, systemDevices } = useAudioDevices();

  const [appState, setAppState] = useState<AppState>({
    direction: "en-es",
    micDeviceId: null,
    systemDeviceId: null,
    outputFolder: null,
    sessionName: null,
    isRecording: false,
    status: "READY",
  });

  const [translationLines, setTranslationLines] = useState<TranslationLine[]>(
    []
  );
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<TranscriptData | null>(
    null
  );
  const [viewingTranscript, setViewingTranscript] = useState(false);
  const [transcriptContent, setTranscriptContent] = useState<{
    source: string;
    target: string;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  // Generate session name based on pattern
  const generateSessionName = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");

    const pattern =
      settings?.defaults.sessionNamePattern ||
      "session-{YYYY}-{MM}-{DD}-{HH}{mm}";

    return pattern
      .replace("{YYYY}", year.toString())
      .replace("{MM}", month)
      .replace("{DD}", day)
      .replace("{HH}", hours)
      .replace("{mm}", minutes);
  }, [settings?.defaults.sessionNamePattern]);

  // Initialize app state when settings are loaded
  useEffect(() => {
    if (settings && !settingsLoading) {
      setAppState((prev) => ({
        ...prev,
        direction: settings.defaults.translationDirection,
        outputFolder:
          settings.defaults.outputFolder || prev.outputFolder || null,
        micDeviceId: settings.defaults.micDeviceId || prev.micDeviceId,
        systemDeviceId: settings.defaults.systemDeviceId || prev.systemDeviceId,
        sessionName: generateSessionName(),
      }));
    }
  }, [settings, settingsLoading, generateSessionName]);

  // Initialize output folder
  useEffect(() => {
    const initializeOutputFolder = async () => {
      try {
        if (window.electronAPI && !appState.outputFolder) {
          const result = await window.electronAPI.getCurrentDirectory();
          if (result.success && result.path) {
            setAppState((prev) => ({
              ...prev,
              outputFolder: result.path || null,
            }));
          }
        }
      } catch (error) {
        console.error("Error getting current directory:", error);
      }
    };
    initializeOutputFolder();
  }, []);

  // Auto-select first available microphone
  useEffect(() => {
    if (micDevices.length > 0 && !appState.micDeviceId) {
      setAppState((prev) => ({ ...prev, micDeviceId: micDevices[0].deviceId }));
    }
  }, [micDevices, appState.micDeviceId]);

  // Memoized computed values
  const canStart = useMemo(() => {
    return Boolean(
      appState.micDeviceId && appState.outputFolder && !appState.isRecording
    );
  }, [appState.micDeviceId, appState.outputFolder, appState.isRecording]);

  const errorMessage = useMemo(() => {
    if (appState.isRecording) return "";
    if (!appState.micDeviceId) return "Please select a microphone";
    if (!appState.outputFolder) return "Please select output folder";
    return "";
  }, [appState.isRecording, appState.micDeviceId, appState.outputFolder]);

  // Recording hook
  const {
    startRecording: startRecordingHook,
    stopRecording: stopRecordingHook,
  } = useRecording({
    onTranslationReceived: useCallback(
      (line: TranslationLine) => {
        setTranslationLines((prev) => {
          const updated = [...prev, line];
          const displayCount = settings?.ui.translationDisplayCount || 3;
          return updated.slice(-displayCount);
        });
      },
      [settings?.ui.translationDisplayCount]
    ),
    onStatusChange: useCallback(
      (
        status: "READY" | "CONNECTING" | "LISTENING" | "RECONNECTING" | "ERROR"
      ) => {
        setAppState((prev) => ({ ...prev, status }));
      },
      []
    ),
    translationDirection: appState.direction,
    outputFolder: appState.outputFolder || "",
    sessionName: appState.sessionName || "",
    micDeviceId: appState.micDeviceId || "",
    systemDeviceId: appState.systemDeviceId || undefined,
  });

  const handleStartRecording = useCallback(async () => {
    setShowCountdown(true);
  }, []);

  const handleCountdownComplete = useCallback(async () => {
    try {
      setShowCountdown(false);
      setShowOverlay(true);
      setAppState((prev) => ({ ...prev, isRecording: true }));
      await startRecordingHook();
    } catch (error) {
      setAppState((prev) => ({ ...prev, isRecording: false }));
      setShowOverlay(false);
    }
  }, [startRecordingHook]);

  const handleStopRecording = useCallback(async () => {
    try {
      // Save transcript info before cleanup
      if (appState.outputFolder && appState.sessionName) {
        const sourceExt = appState.direction === "en-es" ? "en" : "es";
        const targetExt = appState.direction === "en-es" ? "es" : "en";
        setLastTranscript({
          source: `${appState.outputFolder}/${appState.sessionName}-${sourceExt}.txt`,
          target: `${appState.outputFolder}/${appState.sessionName}-${targetExt}.txt`,
          sessionName: appState.sessionName,
          folderPath: appState.outputFolder,
        });
      }

      setAppState((prev) => ({ ...prev, isRecording: false }));
      setTranslationLines([]);
      setShowOverlay(false);
      await stopRecordingHook();
      setAppState((prev) => ({ ...prev, status: "READY" }));
    } catch (error) {
      setAppState((prev) => ({ ...prev, status: "ERROR" }));
    }
  }, [
    stopRecordingHook,
    appState.outputFolder,
    appState.sessionName,
    appState.direction,
  ]);

  const handleStartStop = useCallback(() => {
    if (appState.isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  }, [appState.isRecording, handleStartRecording, handleStopRecording]);

  const selectFolder = useCallback(async () => {
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        setAppState((prev) => ({ ...prev, outputFolder: folderPath }));
        toast.success("Output folder selected");
      }
    } catch (error) {
      console.error("Error selecting folder:", error);
      toast.error("Failed to select folder");
    }
  }, []);


  const viewTranscripts = useCallback(async () => {
    if (!lastTranscript) return;

    try {
      const sourceResult = await window.electronAPI.readTranscriptFile(
        lastTranscript.source
      );
      const targetResult = await window.electronAPI.readTranscriptFile(
        lastTranscript.target
      );

      if (sourceResult.success && targetResult.success) {
        setTranscriptContent({
          source: sourceResult.content || "",
          target: targetResult.content || "",
        });
        setViewingTranscript(true);
      } else {
        toast.error("Failed to load transcripts");
      }
    } catch (error) {
      console.error("Error reading transcripts:", error);
      toast.error("Failed to load transcripts");
    }
  }, [lastTranscript]);

  const deleteTranscripts = useCallback(async () => {
    if (!lastTranscript) return;

    if (confirm("Are you sure you want to delete these transcript files?")) {
      try {
        await window.electronAPI.deleteTranscriptFile(lastTranscript.source);
        await window.electronAPI.deleteTranscriptFile(lastTranscript.target);
        setLastTranscript(null);
        setViewingTranscript(false);
        toast.success("Transcripts deleted successfully");
      } catch (error) {
        console.error("Error deleting transcripts:", error);
        toast.error("Failed to delete transcripts");
      }
    }
  }, [lastTranscript]);

  return (
    <div
      className={`min-h-screen ${
        isDarkMode ? "dark bg-gray-900" : "bg-gray-50"
      }`}
    >
      <CountdownOverlay
        isVisible={showCountdown}
        onComplete={handleCountdownComplete}
      />

      <RecordingOverlay
        isVisible={showOverlay && appState.isRecording}
        translationLines={translationLines}
        onStop={handleStartStop}
      />

      {/* Transcript Viewer Modal */}
      {viewingTranscript && transcriptContent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div
            className={`max-w-6xl w-full ${
              isDarkMode ? "bg-gray-800" : "bg-white"
            } rounded-lg shadow-xl max-h-[90vh] overflow-hidden`}
          >
            <div
              className={`px-6 py-4 border-b ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2
                  className={`text-lg font-semibold ${
                    isDarkMode ? "text-white" : "text-gray-900"
                  }`}
                >
                  Session Transcripts: {lastTranscript?.sessionName}
                </h2>
                <button
                  onClick={() => setViewingTranscript(false)}
                  className={`${
                    isDarkMode
                      ? "text-gray-400 hover:text-gray-300"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div>
                <h3
                  className={`text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {appState.direction === "en-es"
                    ? "English (Source)"
                    : "Spanish (Source)"}
                </h3>
                <div
                  className={`p-4 rounded-md ${
                    isDarkMode ? "bg-gray-900" : "bg-gray-50"
                  } overflow-y-auto max-h-96`}
                >
                  <pre
                    className={`text-sm whitespace-pre-wrap ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {transcriptContent.source || "No content"}
                  </pre>
                </div>
              </div>
              <div>
                <h3
                  className={`text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {appState.direction === "en-es"
                    ? "Spanish (Translation)"
                    : "English (Translation)"}
                </h3>
                <div
                  className={`p-4 rounded-md ${
                    isDarkMode ? "bg-gray-900" : "bg-gray-50"
                  } overflow-y-auto max-h-96`}
                >
                  <pre
                    className={`text-sm whitespace-pre-wrap ${
                      isDarkMode ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {transcriptContent.target || "No content"}
                  </pre>
                </div>
              </div>
            </div>

            <div
              className={`px-6 py-4 border-t ${
                isDarkMode ? "border-gray-700" : "border-gray-200"
              } flex justify-end space-x-3`}
            >
              <button
                onClick={deleteTranscripts}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
              >
                Delete Transcripts
              </button>
              <button
                onClick={() => setViewingTranscript(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimal Header */}
      <header
        className={`${
          isDarkMode
            ? "bg-gray-800 border-gray-700"
            : "bg-white border-gray-200"
        } border-b`}
      >
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1
              className={`text-xl font-semibold ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              Live Translator
            </h1>

            <div className="flex items-center space-x-3">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => {
                  const newTheme = isDarkMode ? "light" : "dark";
                  setTheme(newTheme);
                  if (settings) {
                    updateSettings({
                      ...settings,
                      ui: {
                        ...settings.ui,
                        theme: newTheme,
                      },
                    });
                  }
                }}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {isDarkMode ? (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>

              {/* Settings Button */}
              <button
                onClick={() => setShowSettings(true)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode
                    ? "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 pb-32">
        {lastTranscript && !appState.isRecording && (
          <PostRecordingActions
            transcriptData={lastTranscript}
            onViewTranscripts={viewTranscripts}
            onDeleteTranscripts={deleteTranscripts}
          />
        )}

        {/* Session Setup Card */}
        <SessionSetup
          direction={appState.direction}
          onDirectionChange={(direction) =>
            setAppState((prev) => ({ ...prev, direction }))
          }
          micDevices={micDevices}
          systemDevices={systemDevices}
          selectedMicId={appState.micDeviceId}
          selectedSystemId={appState.systemDeviceId}
          onMicChange={(deviceId) =>
            setAppState((prev) => ({ ...prev, micDeviceId: deviceId }))
          }
          onSystemChange={(deviceId) =>
            setAppState((prev) => ({ ...prev, systemDeviceId: deviceId }))
          }
          outputFolder={appState.outputFolder}
          sessionName={appState.sessionName}
          onFolderSelect={selectFolder}
          onSessionNameChange={(name) =>
            setAppState((prev) => ({
              ...prev,
              sessionName: name || generateSessionName(),
            }))
          }
          disabled={appState.isRecording}
        />

        {/* Error Message */}
        {errorMessage && !appState.isRecording && (
          <div
            className={`mt-6 px-4 py-3 rounded-lg border ${
              isDarkMode
                ? "bg-red-900/20 border-red-800 text-red-400"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            <div className="flex items-center space-x-2">
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <StickyFooter
        status={appState.status}
        isRecording={appState.isRecording}
        canStart={canStart}
        onStartStop={handleStartStop}
      />

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isDarkMode={isDarkMode}
        micDevices={micDevices}
        systemDevices={systemDevices}
        onSettingsUpdate={updateSettings}
      />

      {/* Toast Container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: isDarkMode ? "#374151" : "#ffffff",
            color: isDarkMode ? "#f9fafb" : "#111827",
            border: isDarkMode ? "1px solid #4b5563" : "1px solid #e5e7eb",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: isDarkMode ? "#374151" : "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: isDarkMode ? "#374151" : "#ffffff",
            },
          },
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
