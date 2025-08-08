Perfect. Based on your choices, here’s a tight, implementation-ready PRD Claude Code can ship against without wandering into yak-shaving.

# Electron Live Translator (macOS, v1)

## Goal

A minimal macOS Electron app that:

* Listens to **microphone + system audio** (see capture notes).
* Uses **Deepgram** for real-time STT.
* Uses **Google Translate API** for EN↔ES.
* Displays **only the translation**, up to **3 lines** at a time.
* Writes plain-text transcripts of **source** and **translation** to separate **per-session** files at a **user-chosen path**:

  * `transcript-en.txt`
  * `transcript-es.txt`

## Non-Goals

* Auto language detection (fixed direction per session).
* Offline mode.
* Hotkeys, fancy theming, timestamps, rich text, or multi-window UI.
* Cross-platform packaging (macOS only for v1).

---

## User Stories

1. **Live translate overlay**

   * As a user, I choose **direction** (EN→ES or ES→EN), **audio sources**, and an **output folder**, then click **Start** to see a rolling 3-line translation overlay while speaking/playing audio.
2. **Plain-text transcripts**

   * As a user, when I end a session, I find two files in my chosen folder containing the session’s **source text** and **translated text**, respectively, plain text, no timestamps.

---

## Platform & Dependencies

* **Electron** (latest stable compatible with macOS Sonoma).
* **Deepgram Real-time Streaming** (WebSocket).
* **Google Cloud Translation API** (v2 or v3; choose v2 for simplicity).
* **dotenv** for `.env` loading.
* Minimal UI stack: Electron + vanilla TS/JS + basic CSS.

Environment variables in `.env`:

```
DEEPGRAM_API_KEY=...
GOOGLE_API_KEY=...
```

---

## Audio Capture (macOS)

**Requirement:** capture **microphone + system audio**.

* **Preferred simple path (robust):** instruct user to install a virtual audio device (e.g., **BlackHole 2ch**). User sets macOS output to BlackHole (or creates a Multi-Output Device to keep hearing audio), and selects that device as an input in the app alongside their mic.
* **Implementation:** capture two `MediaStream`s (mic + system/BlackHole) and **mix** to a single stream (WebAudio `AudioContext` + `MediaStreamAudioDestinationNode`) sent to Deepgram.

> Note: Using `desktopCapturer` for system audio is flaky on macOS and may require screen-recording permissions and still not deliver mixable system audio reliably. For v1 fundamentals, depend on BlackHole.

---

## Core Flow

1. **Start**

   * User selects:

     * **Direction**: `EN→ES` or `ES→EN`.
     * **Mic device** and **System device** (BlackHole or equivalent).
     * **Output folder** (required).
   * App creates two **new** files in the folder:

     * `transcript-en.txt`
     * `transcript-es.txt`
       (Overwriting if they already exist in this session; see File Policy.)
2. **Streaming**

   * App mixes mic + system streams → single PCM stream.
   * Open Deepgram **WS** with smart punctuation enabled.
   * **Show only finalized utterances** (no partials) to prioritize quality.
   * On Deepgram **final** result:

     * Determine **source text** in the selected source language.
     * Call **Google Translate** → target language.
     * **Render** translated text in overlay (rolling buffer: max 3 lines).
     * **Append** source text to `transcript-<source>.txt`
     * **Append** translated text to `transcript-<target>.txt`
3. **Stop**

   * Close streams & WS cleanly.
   * Flush/close file handles.

---

## UI Spec (Single Window)

* **Top bar controls**:

  * Direction selector: `EN→ES` / `ES→EN` (radio).
  * Mic input device dropdown.
  * System input device dropdown (expects BlackHole or similar).
  * Output folder picker (required before Start).
  * **Start / Stop** button.
* **Status chip** (text only): `READY`, `CONNECTING`, `LISTENING`, `RECONNECTING`, `ERROR`.
* **Overlay panel** (center):

  * A large text area showing **only translated lines**.
  * Rolling display with **max 3 lines**; new finalized lines push the oldest out.
  * Basic, readable font; resizable window; always-on-top **off by default** (toggle in a simple Settings modal if needed later, but omit for v1 unless you want it).
* **No hotkeys**.

---

## Behavior Details

* **Language handling**

  * Direction set at session start; source/target fixed.
  * For EN→ES: append EN source to `transcript-en.txt`; ES translation to `transcript-es.txt`.
  * For ES→EN: append ES source to `transcript-es.txt`; EN translation to `transcript-en.txt`.
* **STT settings**

  * Deepgram: real-time WS, smart punctuation **on**.
  * Only process **final** transcripts (`is_final === true`).
* **Translation**

  * Google Translate v2 `translate` endpoint.
  * Batch consecutive finalized sentences only if they arrive in the same Deepgram final payload; otherwise 1:1 line mapping.
* **Rate/Latency**

  * Target end-to-end latency (finalized) under \~1.5–2.5s typical.
  * No special batching or retry beyond minimal backoff.

---

## File Output Spec

* **Naming:** exactly `transcript-en.txt` and `transcript-es.txt`.
* **Location:** **user-chosen folder**. Required before Start.
* **Rotation:** **per session**: on Start, truncate/create fresh files.
* **Format:** plain UTF-8 text, one utterance per line, **no timestamps**.
* **Writes:** append only after Deepgram finalization + translation.

---

## Config & Secrets

* `.env` loaded by main process at boot:

  * `DEEPGRAM_API_KEY`, `GOOGLE_API_KEY`
* No UI for key entry in v1.

---

## Error Handling (Minimal)

* **Mic/System device missing:** disable Start; show inline message.
* **Deepgram/Google errors:** status = `ERROR`; keep a simple in-memory log (no file).
* **Network drop:** status `RECONNECTING`; attempt 2 retries with exponential backoff; if fail, set `ERROR` and stop cleanly.
* **Permission denied (mic/screen):** inline message with “Open System Settings” button linking to macOS Privacy panes.

---

## Build & Run

* **Dev:** `npm run dev` launches Electron with live reload.
* **Prod:** `npm run build` (webpack/esbuild) then `npm run dist` via `electron-builder`.
* **Target:** macOS `.dmg` (Apple code-signing out of scope for v1).

---

## Acceptance Criteria (V1 “Done”)

1. On macOS, with BlackHole installed and selected:

   * User can pick **direction**, **mic**, **system** device, and **output folder**.
2. Clicking **Start**:

   * Status transitions to `CONNECTING` then `LISTENING`.
   * Speaking or playing audio produces **translated lines** in the UI.
   * Only **finalized** lines appear; max **3 lines** visible.
3. Files:

   * App creates **fresh** `transcript-en.txt` and `transcript-es.txt` in the chosen folder at Start.
   * By session end, **source** utterances are in the source file; **translated** utterances in the target file; plain text; 1 line per utterance; no timestamps.
4. Clicking **Stop**:

   * Streams close without crashes; status returns to `READY`.
5. Basic failure cases:

   * If keys are missing, Start is disabled with a clear inline message.
   * If network drops, app tries to reconnect up to 2 times, otherwise stops with `ERROR`.

---

## Implementation Notes (for Claude Code)

* **Audio mix:**

  * Get two `MediaStream`s via `navigator.mediaDevices.getUserMedia({ audio: { deviceId }})`.
  * `AudioContext` → create two `MediaStreamAudioSourceNode`s.
  * Mix into `GainNode`s → connect to a single `MediaStreamAudioDestinationNode`.
  * Use destination’s `stream` as the Deepgram input (via WebSocket encoder).
* **Deepgram WS client:**

  * Use official SDK or raw WS. Enable smart punctuation.
  * Filter for `is_final` segments only.
* **Google Translate:**

  * Use v2 REST `https://translation.googleapis.com/language/translate/v2` with API key.
  * Map 1:1 to lines; sanitize newlines before writing.
* **File I/O:**

  * Keep file handles open during session; write `\n` terminated lines.
  * Ensure truncation on Start (`fs.createWriteStream` with `flags: 'w'`).
* **Process model:**

  * Keep STT/translation in **renderer** or **main**—prefer **renderer** for WebAudio access, communicate selected paths via IPC.
  * Use IPC to request main process to create/own file streams to avoid sandbox quirks.
