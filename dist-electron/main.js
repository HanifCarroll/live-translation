import { app, BrowserWindow, session, ipcMain, dialog, shell } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path$1 from "node:path";
import fs$1 from "node:fs";
import require$$0 from "fs";
import require$$1 from "path";
import require$$2 from "os";
import require$$3 from "crypto";
var main = { exports: {} };
const version$1 = "17.2.1";
const require$$4 = {
  version: version$1
};
const fs = require$$0;
const path = require$$1;
const os = require$$2;
const crypto = require$$3;
const packageJson = require$$4;
const version = packageJson.version;
const TIPS = [
  "🔐 encrypt with Dotenvx: https://dotenvx.com",
  "🔐 prevent committing .env to code: https://dotenvx.com/precommit",
  "🔐 prevent building .env in docker: https://dotenvx.com/prebuild",
  "📡 observe env with Radar: https://dotenvx.com/radar",
  "📡 auto-backup env with Radar: https://dotenvx.com/radar",
  "📡 version env with Radar: https://dotenvx.com/radar",
  "🛠️  run anywhere with `dotenvx run -- yourcommand`",
  "⚙️  specify custom .env file path with { path: '/custom/path/.env' }",
  "⚙️  enable debug logging with { debug: true }",
  "⚙️  override existing env vars with { override: true }",
  "⚙️  suppress all logs with { quiet: true }",
  "⚙️  write to custom object with { processEnv: myObject }",
  "⚙️  load multiple .env files with { path: ['.env.local', '.env'] }"
];
function _getRandomTip() {
  return TIPS[Math.floor(Math.random() * TIPS.length)];
}
function parseBoolean(value) {
  if (typeof value === "string") {
    return !["false", "0", "no", "off", ""].includes(value.toLowerCase());
  }
  return Boolean(value);
}
function supportsAnsi() {
  return process.stdout.isTTY;
}
function dim(text) {
  return supportsAnsi() ? `\x1B[2m${text}\x1B[0m` : text;
}
const LINE = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg;
function parse(src) {
  const obj = {};
  let lines = src.toString();
  lines = lines.replace(/\r\n?/mg, "\n");
  let match;
  while ((match = LINE.exec(lines)) != null) {
    const key = match[1];
    let value = match[2] || "";
    value = value.trim();
    const maybeQuote = value[0];
    value = value.replace(/^(['"`])([\s\S]*)\1$/mg, "$2");
    if (maybeQuote === '"') {
      value = value.replace(/\\n/g, "\n");
      value = value.replace(/\\r/g, "\r");
    }
    obj[key] = value;
  }
  return obj;
}
function _parseVault(options) {
  options = options || {};
  const vaultPath = _vaultPath(options);
  options.path = vaultPath;
  const result = DotenvModule.configDotenv(options);
  if (!result.parsed) {
    const err = new Error(`MISSING_DATA: Cannot parse ${vaultPath} for an unknown reason`);
    err.code = "MISSING_DATA";
    throw err;
  }
  const keys = _dotenvKey(options).split(",");
  const length = keys.length;
  let decrypted;
  for (let i = 0; i < length; i++) {
    try {
      const key = keys[i].trim();
      const attrs = _instructions(result, key);
      decrypted = DotenvModule.decrypt(attrs.ciphertext, attrs.key);
      break;
    } catch (error) {
      if (i + 1 >= length) {
        throw error;
      }
    }
  }
  return DotenvModule.parse(decrypted);
}
function _warn(message) {
  console.error(`[dotenv@${version}][WARN] ${message}`);
}
function _debug(message) {
  console.log(`[dotenv@${version}][DEBUG] ${message}`);
}
function _log(message) {
  console.log(`[dotenv@${version}] ${message}`);
}
function _dotenvKey(options) {
  if (options && options.DOTENV_KEY && options.DOTENV_KEY.length > 0) {
    return options.DOTENV_KEY;
  }
  if (process.env.DOTENV_KEY && process.env.DOTENV_KEY.length > 0) {
    return process.env.DOTENV_KEY;
  }
  return "";
}
function _instructions(result, dotenvKey) {
  let uri;
  try {
    uri = new URL(dotenvKey);
  } catch (error) {
    if (error.code === "ERR_INVALID_URL") {
      const err = new Error("INVALID_DOTENV_KEY: Wrong format. Must be in valid uri format like dotenv://:key_1234@dotenvx.com/vault/.env.vault?environment=development");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    }
    throw error;
  }
  const key = uri.password;
  if (!key) {
    const err = new Error("INVALID_DOTENV_KEY: Missing key part");
    err.code = "INVALID_DOTENV_KEY";
    throw err;
  }
  const environment = uri.searchParams.get("environment");
  if (!environment) {
    const err = new Error("INVALID_DOTENV_KEY: Missing environment part");
    err.code = "INVALID_DOTENV_KEY";
    throw err;
  }
  const environmentKey = `DOTENV_VAULT_${environment.toUpperCase()}`;
  const ciphertext = result.parsed[environmentKey];
  if (!ciphertext) {
    const err = new Error(`NOT_FOUND_DOTENV_ENVIRONMENT: Cannot locate environment ${environmentKey} in your .env.vault file.`);
    err.code = "NOT_FOUND_DOTENV_ENVIRONMENT";
    throw err;
  }
  return { ciphertext, key };
}
function _vaultPath(options) {
  let possibleVaultPath = null;
  if (options && options.path && options.path.length > 0) {
    if (Array.isArray(options.path)) {
      for (const filepath of options.path) {
        if (fs.existsSync(filepath)) {
          possibleVaultPath = filepath.endsWith(".vault") ? filepath : `${filepath}.vault`;
        }
      }
    } else {
      possibleVaultPath = options.path.endsWith(".vault") ? options.path : `${options.path}.vault`;
    }
  } else {
    possibleVaultPath = path.resolve(process.cwd(), ".env.vault");
  }
  if (fs.existsSync(possibleVaultPath)) {
    return possibleVaultPath;
  }
  return null;
}
function _resolveHome(envPath) {
  return envPath[0] === "~" ? path.join(os.homedir(), envPath.slice(1)) : envPath;
}
function _configVault(options) {
  const debug = parseBoolean(process.env.DOTENV_CONFIG_DEBUG || options && options.debug);
  const quiet = parseBoolean(process.env.DOTENV_CONFIG_QUIET || options && options.quiet);
  if (debug || !quiet) {
    _log("Loading env from encrypted .env.vault");
  }
  const parsed = DotenvModule._parseVault(options);
  let processEnv = process.env;
  if (options && options.processEnv != null) {
    processEnv = options.processEnv;
  }
  DotenvModule.populate(processEnv, parsed, options);
  return { parsed };
}
function configDotenv(options) {
  const dotenvPath = path.resolve(process.cwd(), ".env");
  let encoding = "utf8";
  let processEnv = process.env;
  if (options && options.processEnv != null) {
    processEnv = options.processEnv;
  }
  let debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || options && options.debug);
  let quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || options && options.quiet);
  if (options && options.encoding) {
    encoding = options.encoding;
  } else {
    if (debug) {
      _debug("No encoding is specified. UTF-8 is used by default");
    }
  }
  let optionPaths = [dotenvPath];
  if (options && options.path) {
    if (!Array.isArray(options.path)) {
      optionPaths = [_resolveHome(options.path)];
    } else {
      optionPaths = [];
      for (const filepath of options.path) {
        optionPaths.push(_resolveHome(filepath));
      }
    }
  }
  let lastError;
  const parsedAll = {};
  for (const path2 of optionPaths) {
    try {
      const parsed = DotenvModule.parse(fs.readFileSync(path2, { encoding }));
      DotenvModule.populate(parsedAll, parsed, options);
    } catch (e) {
      if (debug) {
        _debug(`Failed to load ${path2} ${e.message}`);
      }
      lastError = e;
    }
  }
  const populated = DotenvModule.populate(processEnv, parsedAll, options);
  debug = parseBoolean(processEnv.DOTENV_CONFIG_DEBUG || debug);
  quiet = parseBoolean(processEnv.DOTENV_CONFIG_QUIET || quiet);
  if (debug || !quiet) {
    const keysCount = Object.keys(populated).length;
    const shortPaths = [];
    for (const filePath of optionPaths) {
      try {
        const relative = path.relative(process.cwd(), filePath);
        shortPaths.push(relative);
      } catch (e) {
        if (debug) {
          _debug(`Failed to load ${filePath} ${e.message}`);
        }
        lastError = e;
      }
    }
    _log(`injecting env (${keysCount}) from ${shortPaths.join(",")} ${dim(`-- tip: ${_getRandomTip()}`)}`);
  }
  if (lastError) {
    return { parsed: parsedAll, error: lastError };
  } else {
    return { parsed: parsedAll };
  }
}
function config(options) {
  if (_dotenvKey(options).length === 0) {
    return DotenvModule.configDotenv(options);
  }
  const vaultPath = _vaultPath(options);
  if (!vaultPath) {
    _warn(`You set DOTENV_KEY but you are missing a .env.vault file at ${vaultPath}. Did you forget to build it?`);
    return DotenvModule.configDotenv(options);
  }
  return DotenvModule._configVault(options);
}
function decrypt(encrypted, keyStr) {
  const key = Buffer.from(keyStr.slice(-64), "hex");
  let ciphertext = Buffer.from(encrypted, "base64");
  const nonce = ciphertext.subarray(0, 12);
  const authTag = ciphertext.subarray(-16);
  ciphertext = ciphertext.subarray(12, -16);
  try {
    const aesgcm = crypto.createDecipheriv("aes-256-gcm", key, nonce);
    aesgcm.setAuthTag(authTag);
    return `${aesgcm.update(ciphertext)}${aesgcm.final()}`;
  } catch (error) {
    const isRange = error instanceof RangeError;
    const invalidKeyLength = error.message === "Invalid key length";
    const decryptionFailed = error.message === "Unsupported state or unable to authenticate data";
    if (isRange || invalidKeyLength) {
      const err = new Error("INVALID_DOTENV_KEY: It must be 64 characters long (or more)");
      err.code = "INVALID_DOTENV_KEY";
      throw err;
    } else if (decryptionFailed) {
      const err = new Error("DECRYPTION_FAILED: Please check your DOTENV_KEY");
      err.code = "DECRYPTION_FAILED";
      throw err;
    } else {
      throw error;
    }
  }
}
function populate(processEnv, parsed, options = {}) {
  const debug = Boolean(options && options.debug);
  const override = Boolean(options && options.override);
  const populated = {};
  if (typeof parsed !== "object") {
    const err = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
    err.code = "OBJECT_REQUIRED";
    throw err;
  }
  for (const key of Object.keys(parsed)) {
    if (Object.prototype.hasOwnProperty.call(processEnv, key)) {
      if (override === true) {
        processEnv[key] = parsed[key];
        populated[key] = parsed[key];
      }
      if (debug) {
        if (override === true) {
          _debug(`"${key}" is already defined and WAS overwritten`);
        } else {
          _debug(`"${key}" is already defined and was NOT overwritten`);
        }
      }
    } else {
      processEnv[key] = parsed[key];
      populated[key] = parsed[key];
    }
  }
  return populated;
}
const DotenvModule = {
  configDotenv,
  _configVault,
  _parseVault,
  config,
  decrypt,
  parse,
  populate
};
main.exports.configDotenv = DotenvModule.configDotenv;
main.exports._configVault = DotenvModule._configVault;
main.exports._parseVault = DotenvModule._parseVault;
var config_1 = main.exports.config = DotenvModule.config;
main.exports.decrypt = DotenvModule.decrypt;
main.exports.parse = DotenvModule.parse;
main.exports.populate = DotenvModule.populate;
main.exports = DotenvModule;
createRequire(import.meta.url);
const __dirname = path$1.dirname(fileURLToPath(import.meta.url));
config_1({ path: path$1.join(__dirname, "..", ".env") });
process.env.APP_ROOT = path$1.join(__dirname, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$1.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$1.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$1.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: 600,
    icon: path$1.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path$1.join(__dirname, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
      // Temporarily disable for testing
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$1.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  if (!app.isPackaged) {
    const ses = session.defaultSession;
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = details.responseHeaders || {};
      delete headers["content-security-policy"];
      delete headers["Content-Security-Policy"];
      callback({ responseHeaders: headers });
    });
  }
  createWindow();
});
let transcriptFiles = {
  en: null,
  es: null,
  folderPath: null
};
ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Select Output Folder for Transcripts",
    buttonLabel: "Select Folder"
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});
ipcMain.handle("files:createTranscripts", async (event, folderPath, sessionName = "transcript") => {
  try {
    if (transcriptFiles.en) {
      transcriptFiles.en.end();
      transcriptFiles.en = null;
    }
    if (transcriptFiles.es) {
      transcriptFiles.es.end();
      transcriptFiles.es = null;
    }
    const enPath = path$1.join(folderPath, `${sessionName}-en.txt`);
    const esPath = path$1.join(folderPath, `${sessionName}-es.txt`);
    transcriptFiles.en = fs$1.createWriteStream(enPath, { flags: "w", encoding: "utf8" });
    transcriptFiles.es = fs$1.createWriteStream(esPath, { flags: "w", encoding: "utf8" });
    transcriptFiles.folderPath = folderPath;
    console.log("Created transcript files in:", folderPath);
    return { success: true, folderPath };
  } catch (error) {
    console.error("Error creating transcript files:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("files:appendTranscript", async (event, filename, text) => {
  try {
    const file = filename === "en" ? transcriptFiles.en : transcriptFiles.es;
    if (file) {
      file.write(text + "\n");
      return { success: true };
    }
    return { success: false, error: "File stream not initialized" };
  } catch (error) {
    console.error("Error appending to transcript:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("files:closeTranscripts", async () => {
  try {
    if (transcriptFiles.en) {
      transcriptFiles.en.end();
      transcriptFiles.en = null;
    }
    if (transcriptFiles.es) {
      transcriptFiles.es.end();
      transcriptFiles.es = null;
    }
    transcriptFiles.folderPath = null;
    return { success: true };
  } catch (error) {
    console.error("Error closing transcript files:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("config:getApiKeys", async () => {
  console.log("Getting API keys...");
  console.log("DEEPGRAM_API_KEY:", process.env.DEEPGRAM_API_KEY ? "Found" : "Missing");
  console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY ? "Found" : "Missing");
  return {
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY
  };
});
ipcMain.handle("system:openSettings", async () => {
  try {
    if (process.platform === "darwin") {
      await shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone");
    } else if (process.platform === "win32") {
      await shell.openExternal("ms-settings:privacy-microphone");
    } else {
      await shell.openExternal("gnome-control-center sound");
    }
    return { success: true };
  } catch (error) {
    console.error("Error opening system settings:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("system:getCurrentDirectory", async () => {
  try {
    return { success: true, path: process.cwd() };
  } catch (error) {
    console.error("Error getting current directory:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("system:openExternalUrl", async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error("Error opening external URL:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("files:readTranscript", async (event, filepath) => {
  try {
    const content = fs$1.readFileSync(filepath, "utf-8");
    return { success: true, content };
  } catch (error) {
    console.error("Error reading transcript file:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("files:deleteTranscript", async (event, filepath) => {
  try {
    fs$1.unlinkSync(filepath);
    return { success: true };
  } catch (error) {
    console.error("Error deleting transcript file:", error);
    return { success: false, error: error.message };
  }
});
const settingsFilePath = path$1.join(app.getPath("userData"), "settings.json");
const defaultSettings = {
  apiKeys: {
    deepgram: "",
    google: ""
  },
  defaults: {
    translationDirection: "en-es",
    outputFolder: "",
    micDeviceId: "",
    systemDeviceId: "",
    sessionNamePattern: "session-{YYYY}-{MM}-{DD}-{HH}{mm}"
  },
  ui: {
    theme: "system",
    translationDisplayCount: 3
  }
};
function loadSettings() {
  try {
    if (fs$1.existsSync(settingsFilePath)) {
      const settingsData = fs$1.readFileSync(settingsFilePath, "utf-8");
      const savedSettings = JSON.parse(settingsData);
      return { ...defaultSettings, ...savedSettings };
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  return defaultSettings;
}
function saveSettings(settings) {
  try {
    fs$1.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving settings:", error);
    return false;
  }
}
ipcMain.handle("settings:get", async () => {
  try {
    const settings = loadSettings();
    return { success: true, settings };
  } catch (error) {
    console.error("Error getting settings:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("settings:update", async (event, newSettings) => {
  try {
    const currentSettings = loadSettings();
    const updatedSettings = { ...currentSettings, ...newSettings };
    const saved = saveSettings(updatedSettings);
    if (saved) {
      return { success: true, settings: updatedSettings };
    } else {
      return { success: false, error: "Failed to save settings" };
    }
  } catch (error) {
    console.error("Error updating settings:", error);
    return { success: false, error: error.message };
  }
});
ipcMain.handle("config:getApiKeys", async () => {
  console.log("Getting API keys...");
  const settings = loadSettings();
  let deepgramApiKey = settings.apiKeys.deepgram;
  let googleApiKey = settings.apiKeys.google;
  if (!deepgramApiKey) {
    deepgramApiKey = process.env.DEEPGRAM_API_KEY || "your_deepgram_api_key_here";
  }
  if (!googleApiKey) {
    googleApiKey = process.env.GOOGLE_API_KEY || "your_google_api_key_here";
  }
  console.log("DEEPGRAM_API_KEY:", deepgramApiKey !== "your_deepgram_api_key_here" ? "Found" : "Missing");
  console.log("GOOGLE_API_KEY:", googleApiKey !== "your_google_api_key_here" ? "Found" : "Missing");
  return {
    deepgramApiKey,
    googleApiKey
  };
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
