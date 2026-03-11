const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const si = require('systeminformation');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { randomUUID } = crypto;
const deviceIdFile = path.join(app.getPath('userData'), 'device_id.txt');
const os = require('os');
const http = require('http');


// Load .env.development for Electron (dev/local only)
if (!app.isPackaged) {
  try {
    const dotenv = require('dotenv');
    const dotenvExpand = require('dotenv-expand');
    const envPath = path.join(__dirname, '..', '.env.development');
    if (fs.existsSync(envPath)) {
      dotenvExpand.expand(dotenv.config({ path: envPath }));
    }
  } catch (e) {
    console.warn('[env] Failed to load .env.development:', e.message);
  }
}

function loadFallbackConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'config', 'fallback.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[fallback-config] Failed to load:', err.message);
    return null;
  }
}

const fallbackConfig = loadFallbackConfig() || {};

// === Public Pool Config (remote) ===
let runtimePoolConfig = null;
let runtimePoolConfigLoadedAt = null;
const PUBLIC_CONFIG_REFRESH_MS = 60 * 60 * 1000; // 1 hour

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(',')}}`;
}

function buildPublicConfigUrl() {
  const explicit = process.env.PUBLIC_CONFIG_URL || process.env.MB_PUBLIC_CONFIG_URL;
  if (explicit) return explicit;
  const backendUrl = process.env.BACKEND_URL || process.env.MB_BACKEND_URL || process.env.VITE_BACKEND_URL;
  if (backendUrl) return `${backendUrl.replace(/\/+$/, '')}/public/config`;
  return fallbackConfig.publicConfigUrl || 'https://backend.minebench.cloud/public/config';
}

function parseAllowlist() {
  const raw = process.env.POOL_CONFIG_ALLOWLIST || process.env.MB_POOL_CONFIG_ALLOWLIST;
  if (raw) return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
  const list = Array.isArray(fallbackConfig.poolConfigAllowlist) ? fallbackConfig.poolConfigAllowlist : [];
  return new Set(list.map((s) => String(s).trim()).filter(Boolean));
}

function isValidPort(value) {
  const num = Number(value);
  return Number.isInteger(num) && num > 0 && num <= 65535;
}

function isAllowedHost(host, allowlist) {
  if (!host || typeof host !== 'string') return false;
  const normalized = host.trim().toLowerCase();
  const allowAny = String(process.env.POOL_CONFIG_ALLOW_ANY_HOST || '').toLowerCase() === 'true';
  return allowAny || allowlist.has(normalized);
}

function normalizePoolConfig(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const primary = raw.pool && raw.pool.primary;
  const backup = raw.pool && raw.pool.backup;
  if (!primary) return null;

  const primaryStratumHostRaw = primary.stratumHost || primary.host;
  const primaryRpcHostRaw = primary.rpcHost || primary.host || primary.stratumHost;
  if (!primaryStratumHostRaw || !primaryRpcHostRaw) return null;

  const allowlist = parseAllowlist();
  if (!isAllowedHost(primaryStratumHostRaw, allowlist)) return null;
  if (!isAllowedHost(primaryRpcHostRaw, allowlist)) return null;
  if (!isValidPort(primary.stratumPort) || !isValidPort(primary.rpcPort)) return null;

  const normalized = {
    primary: {
      host: String(primaryStratumHostRaw).trim().toLowerCase(),
      stratumHost: String(primaryStratumHostRaw).trim().toLowerCase(),
      rpcHost: String(primaryRpcHostRaw).trim().toLowerCase(),
      stratumPort: Number(primary.stratumPort),
      rpcPort: Number(primary.rpcPort)
    }
  };

  const backupStratumHostRaw = backup?.stratumHost || backup?.host;
  const backupRpcHostRaw = backup?.rpcHost || backup?.host || backup?.stratumHost;
  if (backup && backupStratumHostRaw && backupRpcHostRaw && isAllowedHost(backupStratumHostRaw, allowlist) && isAllowedHost(backupRpcHostRaw, allowlist) && isValidPort(backup.stratumPort) && isValidPort(backup.rpcPort)) {
    normalized.backup = {
      host: String(backupStratumHostRaw).trim().toLowerCase(),
      stratumHost: String(backupStratumHostRaw).trim().toLowerCase(),
      rpcHost: String(backupRpcHostRaw).trim().toLowerCase(),
      stratumPort: Number(backup.stratumPort),
      rpcPort: Number(backup.rpcPort)
    };
  }

  return normalized;
}

async function loadRemotePoolConfig() {
  try {
    const url = buildPublicConfigUrl();
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();

    const { signature, alg, keyId, ...payload } = json || {};
    const publicKeyPem = process.env.PUBLIC_CONFIG_SIGNING_PUBLIC_KEY_PEM || process.env.MB_PUBLIC_CONFIG_SIGNING_PUBLIC_KEY_PEM || '';

    if (publicKeyPem) {
      if (!signature || alg !== 'ed25519') {
        throw new Error('Missing or invalid signature');
      }
      const data = Buffer.from(stableStringify(payload));
      const sig = Buffer.from(signature, 'base64');
      const ok = crypto.verify(null, data, publicKeyPem, sig);
      if (!ok) throw new Error('Signature verification failed');
    }

    const normalized = normalizePoolConfig(payload);
    if (!normalized) throw new Error('Invalid pool config payload');

    runtimePoolConfig = normalized;
    runtimePoolConfigLoadedAt = Date.now();
    console.log('[public-config] Loaded remote pool config from', url, keyId ? `(keyId=${keyId})` : '');
  } catch (err) {
    console.warn('[public-config] Failed to load remote pool config:', err.message);
  }
}

// Fire and forget; handlers fall back to env if config is not ready
loadRemotePoolConfig();
setInterval(() => {
  const now = Date.now();
  if (!runtimePoolConfigLoadedAt || (now - runtimePoolConfigLoadedAt) >= PUBLIC_CONFIG_REFRESH_MS) {
    loadRemotePoolConfig();
  }
}, PUBLIC_CONFIG_REFRESH_MS);

// === Display Status Tracking for Linux ===
let displayStatus = {
  platform: process.platform,
  isLinux: process.platform === 'linux',
  hasDisplay: true,
  displayWarnings: [],
  isRunningWithSudo: process.getuid && process.getuid() === 0
};

// Check Linux display environment
if (displayStatus.isLinux) {
  if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    displayStatus.hasDisplay = false;
    displayStatus.displayWarnings.push('No X11 (DISPLAY) or Wayland (WAYLAND_DISPLAY) environment detected');
  }
  if (displayStatus.isRunningWithSudo) {
    displayStatus.displayWarnings.push('Running as root (sudo) may break X11 display forwarding');
  }
  if (process.env.DISPLAY && process.env.DISPLAY.startsWith(':')) {
    displayStatus.displayInfo = `Using X11 (DISPLAY=${process.env.DISPLAY})`;
  } else if (process.env.WAYLAND_DISPLAY) {
    displayStatus.displayInfo = `Using Wayland (WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY})`;
  }
}
// === End Display Status Tracking ===

// === Solana OAuth Server for Browser-based Wallet Connection ===
let oauthServer = null;
let oauthCallback = null;

function startOAuthServer() {
  return new Promise((resolve, reject) => {
    // Find available port
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/callback')) {
        const url = new URL(req.url, `http://localhost`);
        const publicKey = url.searchParams.get('publicKey');
        const signature = url.searchParams.get('signature');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>MineBench — Wallet Connected</title>
            <style>
              body { background: #0a0a0a; color: #e5e7eb; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .card { background: #0b0b0b; border: 2px solid #facc15; padding: 2rem; border-radius: 8px; text-align: center; max-width: 500px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
              h1 { color: #facc15; margin: 0 0 1.5rem; font-size: 1.875rem; line-height: 2.25rem; }
              p { color: #d4d4d8; font-size: 1.125rem; line-height: 1.75rem; margin-bottom: 0.5rem; }
              .sub { color: #71717a; font-size: 0.875rem; margin-top: 1.5rem; }
              .icon { color: #facc15; width: 48px; height: 48px; margin-bottom: 1rem; display: inline-block; }
            </style>
          </head>
          <body>
            <div class="card">
              <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1>Wallet Connected</h1>
              <p>You have successfully authenticated.</p>
              <p id="msg">Closing in <span id="timer">3</span>s...</p>
              <div class="sub">Return to the MineBench application to continue.</div>
            </div>
            <script>
                // Auto-close logic
                let seconds = 3;
                const timerInfo = document.getElementById('timer');
                const msgInfo = document.getElementById('msg');
                const interval = setInterval(() => {
                  seconds--;
                  timerInfo.innerText = seconds;
                  if (seconds <= 0) {
                    clearInterval(interval);
                    try { window.close(); } catch(e) {}
                    msgInfo.innerText = "You can close this window now.";
                  }
                }, 1000);
            </script>
          </body>
          </html>
        `);

        if (oauthCallback) {
          oauthCallback({ publicKey, signature });
        }

        // Close server after handling callback
        setTimeout(() => {
          server.close();
          oauthServer = null;
        }, 1000);
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    // Listen on random available port
    server.listen(0, 'localhost', () => {
      const port = server.address().port;
      oauthServer = { server, port };
      resolve(port);
    });

    server.on('error', reject);
  });
}
// === End Solana OAuth Server ===

// === Linux Sandbox Support ===
// Check if user-namespace sandbox is available (Linux only)
function checkUserNamespaceSandboxSupport() {
  if (process.platform !== 'linux') return false;
  try {
    // Check if kernel supports user namespaces
    const fs = require('fs');
    // Test file that indicates user namespace support
    const nsPath = '/proc/self/ns/user';
    return fs.existsSync(nsPath);
  } catch {
    return false;
  }
}

const hasUserNamespaceSandbox = checkUserNamespaceSandboxSupport();
// === End Linux Sandbox Support ===

// === Wayland Support Configuration ===
// Detect and configure Wayland support on Linux
if (process.platform === 'linux' && process.env.WAYLAND_DISPLAY) {
  // Enable Ozone Wayland backend with automatic fallback
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
  // Enable IME on Wayland
  app.commandLine.appendSwitch('enable-wayland-ime', 'true');
  console.log(`[Wayland] Enabled Ozone Wayland support (${displayStatus.displayInfo})`);
} else if (process.platform === 'linux') {
  console.log(`[X11] Running on X11 session${displayStatus.displayInfo ? ` (${displayStatus.displayInfo})` : ''}`);
  if (displayStatus.displayWarnings.length > 0) {
    displayStatus.displayWarnings.forEach(w => console.warn(`[Display Warning] ${w}`));
  }

  // Linux sandbox configuration for AppImage compatibility
  if (hasUserNamespaceSandbox) {
    // Use user-namespace sandbox (preferred, more secure)
    app.commandLine.appendSwitch('enable-userns-sandbox');
    console.log('[Sandbox] Using kernel user-namespace sandbox (secure)');
  } else {
    // Fallback: disable sandbox if kernel doesn't support user namespaces
    // This is necessary in containers, some VMs, and older kernels
    app.commandLine.appendSwitch('no-sandbox');
    console.warn('[Sandbox] User-namespace not available; sandbox disabled. Running in less-secure mode.');
    displayStatus.displayWarnings.push('Sandbox disabled: kernel does not support user-namespaces. Consider updating your system.');
  }

  // Disable GPU acceleration in problematic environments (some VMs, containers)
  if (process.env.DISABLE_GPU_ACCEL || process.env.CI) {
    app.commandLine.appendSwitch('disable-gpu');
    console.log('[GPU] Disabled GPU acceleration due to environment');
  }
  // Reduce memory issues in constrained environments
  app.commandLine.appendSwitch('disable-dev-shm-usage');
}
// === End Wayland Configuration ===

const workerNameGlobal = os.cpus()[0].model.replace(/\s+/g, '-') ?? "MineBench-Client";
const supabase = createClient('https://mmwtuyllptkelcfujaod.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1td3R1eWxscHRrZWxjZnVqYW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDA2ODIsImV4cCI6MjA3NjUxNjY4Mn0.CGVlOAFfRWR9MyRpYW99gppLgVMcrG8sz83bO3YEhoA')

// Premium status tracking
let isPremium = false;
let premiumXmrWallet = null;

async function checkPremiumStatus(publicKey) {
  if (!publicKey) return { isPremium: false, xmrWallet: null };
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_premium, xmr_wallet')
      .eq('wallet_address', publicKey)
      .single();

    if (error) {
      console.error('[Supabase] Premium check error:', error);
      return { isPremium: false, xmrWallet: null };
    }

    return {
      isPremium: data?.is_premium || false,
      xmrWallet: data?.xmr_wallet || null
    };
  } catch (err) {
    console.error('[Supabase] Premium check critical error:', err);
    return { isPremium: false, xmrWallet: null };
  }
}

let deviceUID;
let miner = null;
let currentMinerType = null; // 'cpu' or 'gpu'
let hashRates = [];
let temps = [];
let powers = []; // For GPU power
let startTime = null;

if (fs.existsSync(deviceIdFile)) {
  deviceUID = fs.readFileSync(deviceIdFile, 'utf8');
} else {
  deviceUID = randomUUID();
  fs.writeFileSync(deviceIdFile, deviceUID);
}

ipcMain.handle('get-cpu-name', () => {
  return os.cpus()[0].model;
});

ipcMain.handle('get-cpu-info', async () => {
  const cpuCaps = await getCPUCapabilities();
  return {
    model: cpuCaps.model,
    cores: cpuCaps.cores,
    hasAES: cpuCaps.hasAES,
    hasAVX: cpuCaps.hasAVX,
    hasAVX2: cpuCaps.hasAVX2,
    arch: process.arch,
    platform: process.platform,
    supportsStandardXmrig: cpuCaps.hasAVX2,
    supportsCompatXmrig: cpuCaps.hasAES,
    message: cpuCaps.hasAVX2 ? '✅ Full support' : (cpuCaps.hasAES ? '⚠️ Limited support (use compat version)' : '❌ Legacy only')
  };
});

ipcMain.handle('get-cpu-cores', () => {
  return os.cpus().length;
});

ipcMain.handle('get-premium-status', async (event, publicKey) => {
  return await checkPremiumStatus(publicKey);
});


// Cache CPU capabilities to avoid repeated detection
let cachedCpuCaps = null;

async function getCPUCapabilities() {
  if (cachedCpuCaps) return cachedCpuCaps;

  const model = os.cpus()?.[0]?.model || 'Unknown CPU';
  const cores = os.cpus().length || 1;
  let flags = '';
  try {
    flags = await si.cpuFlags();
  } catch (e) {
    flags = '';
  }

  const f = String(flags).toLowerCase();
  const hasAES = f.includes('aes');
  const hasAVX = f.includes('avx');
  const hasAVX2 = f.includes('avx2');

  const caps = {
    model,
    cores,
    hasAES,
    hasAVX,
    hasAVX2,
    arch: process.arch,
    platform: process.platform,
    supportsStandardXmrig: hasAVX2,
    supportsCompatXmrig: hasAES,
    message: hasAVX2 ? '? Full support' : (hasAES ? '?? Limited support (use compat version)' : '? Legacy only')
  };

  cachedCpuCaps = caps;
  return caps;
}

async function getMinerPath(minerName) {
  const platform = process.platform; // 'win32', 'darwin', 'linux'
  const arch = process.arch; // 'x64', 'arm64'

  let platformDir;
  let exeExt = '';

  if (platform === 'win32') {
    platformDir = arch === 'arm64' ? 'win-arm64' : 'win-x64';
    exeExt = '.exe';
  } else if (platform === 'darwin') {
    platformDir = arch === 'arm64' ? 'macos-arm64' : 'macos-x64';
  } else {
    platformDir = 'linux-x64';
  }

  const minerFolder = minerName.toLowerCase() === 'xmrig' ? 'Xmrig' : minerName;
  const minerExe = `${minerName}${exeExt}`;

  let minerSubDir = '';
  if (minerName.toLowerCase() === 'xmrig') {
    const cpuCaps = await getCPUCapabilities();
    log(`[getMinerPath] CPU: ${cpuCaps.model} | Cores: ${cpuCaps.cores} | AES: ${cpuCaps.hasAES} | AVX: ${cpuCaps.hasAVX} | AVX2: ${cpuCaps.hasAVX2}`);
    if (cpuCaps.hasAVX2) {
      log('[getMinerPath] ? Using xmrig standard version (full CPU support)');
      minerSubDir = '';
    } else if (cpuCaps.hasAES) {
      log('[getMinerPath] ?? Using xmrig COMPAT version (AES only)');
      minerSubDir = 'compat';
    } else {
      log('[getMinerPath] ?? Using xmrig LEGACY version for old CPU (no AVX2/AES)');
      minerSubDir = 'legacy';
    }
  }

  const platformPath = minerSubDir ? path.join(platformDir, minerSubDir) : platformDir;

  if (app.isPackaged) {
    const resourcesPath = path.dirname(process.execPath);
    const minerFullPath = path.join(resourcesPath, 'Miner', minerFolder, platformPath, minerExe);
    try {
      const exists = fs.existsSync(minerFullPath);
      log(`[getMinerPath] Selected miner path: ${minerFullPath} | exists: ${exists}`);
    } catch (e) {
      log(`[getMinerPath] Selected miner path: ${minerFullPath} | exists: unknown (error: ${e.message})`);
    }
    return minerFullPath;
  } else {
    const minerFullPath = path.join(__dirname, '..', 'Miner', minerFolder, platformPath, minerExe);
    try {
      const exists = fs.existsSync(minerFullPath);
      log(`[getMinerPath] Selected miner path: ${minerFullPath} | exists: ${exists}`);
    } catch (e) {
      log(`[getMinerPath] Selected miner path: ${minerFullPath} | exists: unknown (error: ${e.message})`);
    }
    return minerFullPath;
  }
}

ipcMain.handle('get-system-stats', async () => {
  try {
    // NOTE:
    // - os.loadavg() returns 0 on Windows, so it can't be used for CPU usage there.
    // - systeminformation provides cross-platform CPU load and memory usage.
    const [load, mem] = await Promise.all([
      si.currentLoad(),
      si.mem()
    ]);

    const cpuUsage = typeof load?.currentLoad === 'number' ? load.currentLoad : 0;
    const ramTotal = typeof mem?.total === 'number' ? mem.total : os.totalmem();
    const ramUsed = typeof mem?.used === 'number' ? mem.used : (os.totalmem() - os.freemem());

    return {
      cpuUsage: Math.max(0, Math.min(cpuUsage, 100)), // Clamp to [0..100]
      ramUsage: Math.max(0, ramUsed),
      ramTotal: Math.max(0, ramTotal)
    };
  } catch (err) {
    console.error('Error reading system stats:', err);
    return {
      cpuUsage: 0,
      ramUsage: 0,
      ramTotal: os.totalmem()
    };
  }
});

ipcMain.handle("report-stats", async (event, { temp, power }) => {
  if (typeof temp === "number") temps.push(temp);
  if (typeof power === "number") powers.push(power);
});

async function sendToDatabase(data) {
  try {
    const { error } = await supabase
      .from('benchmarks')
      .insert([data]);

    if (error) {
      console.error("❌ Database insert error:", error.message);
      return { success: false, error: error.message };
    }

    console.log("✅ Data sent to Supabase:", data);
    return { success: true };
  } catch (err) {
    console.error("❌ Unexpected DB error:", err);
    return { success: false, error: err.message };
  }
}

// Cache CPU temperature to avoid redundant queries
let cachedCpuTemp = null;
let lastCpuTempTime = 0;
const CPU_TEMP_CACHE_MS = 2000; // Cache for 2 seconds
const CPU_POWER_CACHE_MS = 2000; // Cache for 2 seconds
let cachedCpuPower = null;
let lastCpuPowerTime = 0;

ipcMain.handle('get-cpu-temp', async () => {
  try {
    const now = Date.now();

    // Return cached value if still fresh
    if (cachedCpuTemp !== null && (now - lastCpuTempTime) < CPU_TEMP_CACHE_MS) {
      return { success: true, temp: cachedCpuTemp };
    }

    const tempData = await si.cpuTemperature();
    if (tempData.main === null) {
      return { success: false, temp: null, message: 'Cannot read CPU temperature' };
    }

    // Cache the result
    cachedCpuTemp = tempData.main;
    lastCpuTempTime = now;

    return { success: true, temp: tempData.main };
  } catch (err) {
    console.error('Error reading CPU temp:', err);
    return { success: false, temp: null, message: 'Error reading CPU temperature' };
  }
});

ipcMain.handle('get-cpu-power', async () => {
  try {
    const now = Date.now();
    if (cachedCpuPower !== null && (now - lastCpuPowerTime) < CPU_POWER_CACHE_MS) {
      return { success: true, power: cachedCpuPower };
    }

    if (typeof si.cpuPower !== 'function') {
      return { success: false, power: null, message: 'cpuPower not supported' };
    }

    const powerData = await si.cpuPower();
    const powerValue =
      (typeof powerData?.power === 'number' && Number.isFinite(powerData.power) ? powerData.power : null) ??
      (typeof powerData?.package === 'number' && Number.isFinite(powerData.package) ? powerData.package : null) ??
      (typeof powerData?.current === 'number' && Number.isFinite(powerData.current) ? powerData.current : null);

    if (powerValue === null) {
      return { success: false, power: null, message: 'Cannot read CPU power' };
    }

    cachedCpuPower = powerValue;
    lastCpuPowerTime = now;
    return { success: true, power: powerValue };
  } catch (err) {
    console.error('Error reading CPU power:', err);
    return { success: false, power: null, message: 'Error reading CPU power' };
  }
});

// Window controls
ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.close();
});

// Auto-start on boot (Windows/macOS)
function isAutoStartSupported() {
  return process.platform === 'win32' || process.platform === 'darwin';
}

ipcMain.handle('get-auto-start', () => {
  if (!isAutoStartSupported()) {
    return { supported: false, enabled: false };
  }
  try {
    const settings = app.getLoginItemSettings();
    return { supported: true, enabled: !!settings.openAtLogin };
  } catch (err) {
    console.error('[auto-start] get failed', err);
    return { supported: true, enabled: false, error: err.message };
  }
});

ipcMain.handle('set-auto-start', (event, enable) => {
  if (!isAutoStartSupported()) {
    return { success: false, supported: false, enabled: false };
  }
  try {
    const openAtLogin = !!enable;
    app.setLoginItemSettings({ openAtLogin, openAsHidden: true });
    const settings = app.getLoginItemSettings();
    return { success: true, supported: true, enabled: !!settings.openAtLogin };
  } catch (err) {
    console.error('[auto-start] set failed', err);
    return { success: false, supported: true, enabled: false, error: err.message };
  }
});

// === Miner Settings Persistence ===
const settingsFilePath = path.join(app.getPath('userData'), 'miner-settings.json');

ipcMain.handle('save-miner-settings', async (event, settings) => {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    console.log('✅ Miner settings saved to:', settingsFilePath);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to save miner settings:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('load-miner-settings', async (event) => {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const settings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
      console.log('✅ Miner settings loaded from:', settingsFilePath);
      return { success: true, settings };
    }
    return { success: false, settings: null };
  } catch (err) {
    console.error('❌ Failed to load miner settings:', err);
    return { success: false, error: err.message, settings: null };
  }
});

// === Miner Logs Persistence ===
const logsDir = path.join(app.getPath('userData'), 'logs');
const MAX_LOG_AGE_DAYS = 7;

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('✅ Logs directory created:', logsDir);
}

// Cleanup old logs (older than 7 days)
function cleanupOldLogs() {
  try {
    const now = Date.now();
    const maxAgeMs = MAX_LOG_AGE_DAYS * 24 * 60 * 60 * 1000; // 7 days in ms

    const files = fs.readdirSync(logsDir);
    let deletedCount = 0;

    for (const file of files) {
      const filepath = path.join(logsDir, file);
      const stat = fs.statSync(filepath);
      const fileAge = now - stat.mtime.getTime();

      if (fileAge > maxAgeMs) {
        fs.unlinkSync(filepath);
        console.log(`🗑️ Deleted old log: ${file} (${Math.floor(fileAge / (24 * 60 * 60 * 1000))} days old)`);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Cleanup complete: removed ${deletedCount} old log(s)`);
    }
  } catch (err) {
    console.error('❌ Failed to cleanup old logs:', err);
  }
}

ipcMain.handle('save-miner-logs', async (event, { systemLogs, minerLogs, sessionType, device }) => {
  try {
    // Run cleanup before saving new log
    cleanupOldLogs();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `minebench-${sessionType}-${device}-${timestamp}.log`;
    const filepath = path.join(logsDir, filename);

    const content = `
=== MineBench ${sessionType.toUpperCase()} Logs ===
Device: ${device}
Timestamp: ${new Date().toISOString()}
Logs Directory: ${logsDir}

=== SYSTEM LOGS ===
${systemLogs.join('\n')}

=== MINER LOGS ===
${minerLogs.join('\n')}
`.trim();

    fs.writeFileSync(filepath, content, 'utf8');
    console.log('✅ Miner logs saved to:', filepath);
    return { success: true, filepath, logsDir };
  } catch (err) {
    console.error('❌ Failed to save miner logs:', err);
    return { success: false, error: err.message };
  }
});

// Save an incident log with details for forensic analysis
function saveIncidentLog(name, details) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `miner-incident-${name}-${timestamp}.log`;
    const filepath = path.join(logsDir, filename);
    const content = `Incident: ${name}\nTime: ${new Date().toISOString()}\n\n${JSON.stringify(details, null, 2)}`;
    fs.writeFileSync(filepath, content, 'utf8');
    console.warn(`[Incident] Saved to ${filepath}`);
    return filepath;
  } catch (err) {
    console.error('[Incident] Failed to save incident log:', err);
    return null;
  }
}

ipcMain.handle('get-logs-directory', async () => {
  return { path: logsDir, exists: fs.existsSync(logsDir) };
});

// Renderer process logging - sends UI logs to main process for file persistence
ipcMain.handle('log-to-file', async (event, { level, message, source }) => {
  try {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${source}] [${level.toUpperCase()}]`;
    const logLine = `${prefix} ${message}`;

    // Write to app log file
    const date = new Date().toISOString().slice(0, 10);
    const appLog = path.join(logsDir, `app-${date}.log`);
    fs.appendFileSync(appLog, logLine + '\n', 'utf8');

    // Also output to console for immediate visibility
    const consoleMethod = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    consoleMethod(`${prefix} ${message}`);

    return { success: true };
  } catch (err) {
    console.error('[log-to-file] Failed:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder does not exist' };
    }

    const command = process.platform === 'win32'
      ? `explorer "${folderPath}"`
      : process.platform === 'darwin'
        ? `open "${folderPath}"`
        : `xdg-open "${folderPath}"`;

    require('child_process').exec(command, (err) => {
      if (err) console.error('Failed to open folder:', err);
    });

    return { success: true };
  } catch (err) {
    console.error('Failed to open folder:', err);
    return { success: false, error: err.message };
  }
});

// Expose display status to renderer
ipcMain.handle('get-display-status', () => {
  return displayStatus;
});

ipcMain.handle('open-external', async (event, url) => {
  try {
    if (typeof url !== 'string' || !url.trim()) {
      return { success: false, error: 'Invalid URL' };
    }
    await shell.openExternal(url);
    return { success: true };
  } catch (err) {
    console.error('[open-external] Failed:', err);
    return { success: false, error: err?.message || String(err) };
  }
});

// === Solana Wallet IPC Handlers ===
ipcMain.handle('solana-connect-wallet', async () => {
  try {
    console.log('[Solana] Starting wallet connection...');

    // Start OAuth server
    const port = await startOAuthServer();
    console.log('[Solana] OAuth server started on port:', port);

    // Determine auth URL based on MINEBENCH_MODE or packaged status
    const mode = process.env.MINEBENCH_MODE || (app.isPackaged ? 'production' : 'development');
    const baseUrl = mode === 'production' ? 'https://minebench.cloud' : 'http://localhost:3000';
    const authUrl = `${baseUrl}/wallet-connect?callbackUrl=${encodeURIComponent(`http://localhost:${port}/callback`)}`;
    console.log('[Solana] Mode:', mode);
    console.log('[Solana] Opening browser with URL:', authUrl);

    // Open default browser
    await shell.openExternal(authUrl);
    console.log('[Solana] Browser opened, waiting for callback...');

    // Wait for callback
    return new Promise((resolve, reject) => {
      oauthCallback = async (data) => {
        console.log('[Solana] Callback received:', { publicKey: data.publicKey?.slice(0, 8) + '...' });
        
        // Check premium status
        const premiumData = await checkPremiumStatus(data.publicKey);
        isPremium = premiumData.isPremium;
        premiumXmrWallet = premiumData.xmrWallet;
        console.log('[Solana] Premium status:', { isPremium, hasWallet: !!premiumXmrWallet });

        resolve({
          ...data,
          isPremium,
          premiumXmrWallet
        });
        oauthCallback = null;
      };

      // Timeout after 5 minutes
      setTimeout(() => {
        console.log('[Solana] Authentication timeout');
        if (oauthServer) {
          oauthServer.server.close();
          oauthServer = null;
        }
        reject(new Error('Authentication timeout'));
      }, 5 * 60 * 1000);
    });
  } catch (error) {
    console.error('[Solana] Connect wallet error:', error);
    throw error;
  }
});

ipcMain.handle('solana-disconnect-wallet', async () => {
  // Cleanup any OAuth server if running
  if (oauthServer) {
    oauthServer.server.close();
    oauthServer = null;
  }
  oauthCallback = null;
  return { success: true };
});

// Proxy Solana RPC balance lookup to avoid CORS/rate limits
ipcMain.handle('solana-get-token-balance', async (event, { owner, mint }) => {
  try {
    if (!owner || !mint) throw new Error('owner and mint are required');
    const endpoints = [
      process.env.MB_SOL_RPC,
      'https://api.mainnet-beta.solana.com',
      'https://rpc.ankr.com/solana'
    ].filter(Boolean);
    const TOKEN_PROGRAMS = [
      'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
      'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
    ];

    const post = async (url, body) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json?.error) throw new Error(json.error.message || 'RPC error');
      return json;
    };

    let total = 0;
    let found = false;

    // 1) Try direct mint filter first on available endpoints
    for (const url of endpoints) {
      try {
        const body = {
          jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
          params: [owner, { mint }, { encoding: 'jsonParsed' }]
        };
        const json = await post(url, body);
        const list = json?.result?.value ?? [];
        if (list.length > 0) {
          for (const acc of list) {
            const amt = acc?.account?.data?.parsed?.info?.tokenAmount;
            if (amt && typeof amt.uiAmount === 'number') total += amt.uiAmount;
            else if (amt?.uiAmountString) total += Number(amt.uiAmountString);
          }
          found = true;
          break;
        }
      } catch (e) {
        console.warn('[solana-get-token-balance] mint filter failed on', url, e.message);
      }
    }

    // 2) Fallback: query by programId and filter by mint
    if (!found) {
      for (const url of endpoints) {
        for (const programId of TOKEN_PROGRAMS) {
          try {
            const body = {
              jsonrpc: '2.0', id: 1, method: 'getTokenAccountsByOwner',
              params: [owner, { programId }, { encoding: 'jsonParsed' }]
            };
            const json = await post(url, body);
            const list = json?.result?.value ?? [];
            for (const acc of list) {
              const info = acc?.account?.data?.parsed?.info;
              if (info?.mint === mint) {
                const amt = info?.tokenAmount;
                if (amt && typeof amt.uiAmount === 'number') total += amt.uiAmount;
                else if (amt?.uiAmountString) total += Number(amt.uiAmountString);
              }
            }
            if (total > 0) { found = true; break; }
          } catch (e) {
            console.warn('[solana-get-token-balance] programId failed on', url, e.message);
          }
        }
        if (found) break;
      }
    }

    return { success: true, balance: total };
  } catch (e) {
    return { success: false, error: e?.message || 'Unknown error' };
  }
});

// === P2Pool RPC IPC Handler (to bypass CORS) ===
ipcMain.handle('p2pool-rpc-call', async (event, { method, params = {}, host = 'node.minebench.cloud', port = 18081 }) => {
  try {
    return await new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        jsonrpc: '2.0',
        id: '0',
        method,
        params
      });

      const options = {
        hostname: host,
        port: port,
        path: '/json_rpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) {
              reject(new Error(json.error.message || 'RPC Error'));
            } else {
              resolve(json.result);
            }
          } catch (e) {
            reject(new Error('Invalid RPC response'));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`P2Pool RPC failed: ${e.message}`));
      });

      req.write(postData);
      req.end();
    });
  } catch (err) {
    console.error('[P2PoolRPC]', err.message);
    return { success: false, error: err.message };
  }
});
// === End P2Pool RPC IPC Handler ===

// === End Solana Wallet IPC Handlers ===

const { exec } = require('child_process');

// Helper to parse sync from docker logs if RPC is hanging
function getSyncFromLogs(containerName) {
  return new Promise((resolve) => {
    exec(`docker logs ${containerName} --tail 50`, (error, stdout, stderr) => {
      if (error) return resolve(null);

      // Look for "Synced 1467460/3593716 (40%, 2126256 left)"
      const lines = stdout.split('\n').reverse();
      const syncRegex = /Synced\s+(\d+)\/(\d+)\s+\((\d+(?:\.\d+)?)%/;

      for (const line of lines) {
        const match = line.match(syncRegex);
        if (match) {
          const height = parseInt(match[1]);
          const targetHeight = parseInt(match[2]);
          // Calculate progress ourselves for better precision
          const progress = targetHeight > 0 ? (height / targetHeight) * 100 : 0;
          return resolve({ height, targetHeight, progress });
        }
      }
      resolve(null);
    });
  });
}

// Helper for more robust local requests on Windows/Docker
function robustGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MineBench-Client/1.0'
      },
      timeout: 5000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw new Error(`Status ${res.statusCode}`);
          resolve(JSON.parse(data));
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.abort(); reject(new Error('Timeout')); });
  });
}

// Cache для збереження останнього успішного статусу
const poolStatusCache = new Map();

function getRuntimePool() {
  return runtimePoolConfig;
}

function mapLegacyPrimaryHost(host, role = 'stratum') {
  const normalized = String(host || '').trim().toLowerCase();
  if (normalized !== 'xmr.minebench.cloud') return host;
  return role === 'rpc' ? 'node.minebench.cloud' : 'xmr.minebench.cloud';
}

function getPoolEnvConfig() {
  const runtime = getRuntimePool();
  const defaults = fallbackConfig.defaults || {};
  const primaryPoolHost = mapLegacyPrimaryHost(
    runtime?.primary?.stratumHost || runtime?.primary?.host || process.env.PRIMARY_POOL_HOST || process.env.MB_POOL_HOST || defaults.primaryPoolHost || defaults.primaryHost || 'xmr.minebench.cloud',
    'stratum'
  );
  const backupPoolHost = runtime?.backup?.stratumHost || runtime?.backup?.host || process.env.BACKUP_POOL_HOST || process.env.MB_POOL_HOST_BACKUP || defaults.backupPoolHost || defaults.backupHost || 'xmr2.minebench.cloud';
  const primaryRpcHost = mapLegacyPrimaryHost(
    runtime?.primary?.rpcHost || process.env.PRIMARY_RPC_HOST || process.env.MB_RPC_HOST || defaults.primaryRpcHost || defaults.primaryHost || primaryPoolHost,
    'rpc'
  );
  const backupRpcHost = runtime?.backup?.rpcHost || process.env.BACKUP_RPC_HOST || process.env.MB_RPC_HOST_BACKUP || defaults.backupRpcHost || defaults.backupHost || backupPoolHost;

  const useInternalRpc = String(process.env.PRIMARY_RPC_USE_INTERNAL ?? process.env.MB_RPC_USE_INTERNAL ?? 'false').toLowerCase() === 'true';
  const useInternalRpcBackup = String(process.env.BACKUP_RPC_USE_INTERNAL ?? process.env.MB_RPC_BACKUP_USE_INTERNAL ?? 'false').toLowerCase() === 'true';

  const rpcPortExternal = Number(process.env.PRIMARY_RPC_PORT || process.env.MB_RPC_PORT) || defaults.moneroRpcPort || 18081;
  const rpcPortInternal = Number(process.env.PRIMARY_RPC_PORT_INTERNAL || process.env.MB_RPC_PORT_INTERNAL) || rpcPortExternal;
  const rpcPortExternalBackupEnv = Number(process.env.BACKUP_RPC_PORT || process.env.MB_RPC_PORT_BACKUP) || 0;
  const rpcPortInternalBackupEnv = Number(process.env.BACKUP_RPC_PORT_INTERNAL || process.env.MB_RPC_PORT_INTERNAL_BACKUP) || 0;

  const primaryRpcPort = runtime?.primary?.rpcPort ?? (useInternalRpc ? rpcPortInternal : rpcPortExternal);
  const backupRpcPort = runtime?.backup?.rpcPort ?? (useInternalRpcBackup ? rpcPortInternalBackupEnv : rpcPortExternalBackupEnv);

  const primaryStratumPort = runtime?.primary?.stratumPort ?? (Number(process.env.PRIMARY_STRATUM_PORT || process.env.MB_STRATUM_PORT) || defaults.stratumPort || 3333);
  const backupStratumPort = runtime?.backup?.stratumPort ?? (Number(process.env.BACKUP_STRATUM_PORT || process.env.MB_STRATUM_PORT_BACKUP) || 0);

  return {
    primaryPoolHost,
    backupPoolHost,
    primaryRpcHost,
    backupRpcHost,
    primaryRpcPort,
    backupRpcPort,
    primaryStratumPort,
    backupStratumPort
  };
}


ipcMain.handle('get-pool-sync', async (event, poolId) => {
  // Mapping IDs to their RPC ports
  // Development: Local Docker containers with mapped RPC ports
  // Production: MineBench Cloud node deployed on Akash (node.minebench.cloud)
  // NOTE: RPC port is forwarded on Akash; keep this in sync with current lease
  const {
    primaryRpcHost: rpcHost,
    backupRpcHost: rpcHostBackup,
    primaryRpcPort: rpcPort,
    backupRpcPort: rpcPortBackup
  } = getPoolEnvConfig();

  if (!rpcPortBackup) {
    console.log('[get-pool-sync] Backup RPC port not set; skipping backup checks');
  }

  const poolConfigs = {
    'cpu': {
      host: rpcHost,
      port: rpcPort, // Akash forwarded port for 18081 RPC
      container: 'minebench-monerod'
    },
    'cpu-backup': rpcPortBackup ? {
      host: rpcHostBackup,
      port: rpcPortBackup,
      container: 'minebench-monerod-backup'
    } : null,
    'gpu': {
      host: rpcHost,
      port: rpcPort, // Same RPC endpoint
      container: 'minebench-gpu-node'
    }
  };

  const config = poolConfigs[poolId] || poolConfigs['cpu'];
  if (!config) {
    return {
      success: false,
      id: poolId,
      connected: false,
      message: "Backup not configured",
      isSynced: false,
      progress: 0
    };
  }
  const urls = [`http://${config.host}:${config.port}/get_info`];

  // Try to get fresh data
  for (const url of urls) {
    try {
      console.log(`[get-pool-sync][${poolId}] Fetching ${url}...`);
      const data = await robustGet(url);

      const height = data.height || 0;
      const targetHeight = data.target_height || height || 1;
      const isSynced = data.synchronized || (height >= targetHeight && height > 0);
      const progress = targetHeight > 0 ? (height / targetHeight) * 100 : 0;
      const safeProgress = isNaN(progress) ? 0 : Math.min(progress, 100);

      console.log(`[get-pool-sync][${poolId}] Success: ${height}/${targetHeight} (${safeProgress.toFixed(1)}%)`);

      const successStatus = {
        success: true,
        id: poolId,
        isSynced,
        height,
        targetHeight,
        progress: safeProgress,
        connected: true,
        message: isSynced ? "Ready" : "Syncing"
      };

      poolStatusCache.set(poolId, successStatus);
      return successStatus;
    } catch (err) {
      console.error(`[get-pool-sync][${poolId}] Error ${url}: ${err.message}`);
    }
  }

  // Try JSON-RPC POST
  try {
    const response = await fetch(`http://${config.host}:${config.port}/json_rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: '0', method: 'get_info' }),
      signal: AbortSignal.timeout(3000)
    });
    const json = await response.json();
    const data = json.result;
    if (data) {
      const height = data.height || 0;
      const targetHeight = data.target_height || height || 1;
      const isSynced = data.synchronized || (height >= targetHeight && height > 0);
      const progress = targetHeight > 0 ? (height / targetHeight) * 100 : 0;
      const safeProgress = isNaN(progress) ? 0 : Math.min(progress, 100);

      const successStatus = {
        success: true,
        id: poolId,
        isSynced,
        height,
        targetHeight,
        progress: safeProgress,
        connected: true,
        message: isSynced ? "Ready" : "Syncing"
      };

      poolStatusCache.set(poolId, successStatus);
      return successStatus;
    }
  } catch (e) {
    console.error(`[get-pool-sync][${poolId}] JSON-RPC Error: ${e.message}`);
  }

  // FINAL FALLBACK: Parse Docker Logs directly (only for local dev)
  if (config.host === 'localhost' || config.host === '127.0.0.1') {
    const logData = await getSyncFromLogs(config.container);
    if (logData) {
      const successStatus = {
        success: true,
        id: poolId,
        isSynced: logData.progress >= 99.9,
        height: logData.height,
        targetHeight: logData.targetHeight,
        progress: logData.progress,
        connected: false,
        message: "Syncing (logs)"
      };

      poolStatusCache.set(poolId, successStatus);
      return successStatus;
    }
  }

  // If all attempts failed, return cached status if any
  const cachedStatus = poolStatusCache.get(poolId);
  if (cachedStatus) {
    console.log(`[get-pool-sync][${poolId}] Using cached status: ${cachedStatus.progress.toFixed(1)}%`);
    return {
      ...cachedStatus,
      connected: false,
      message: "Using cached data"
    };
  }

  // For production Akash pool: show actual RPC status
  if (config.host === 'node.minebench.cloud') {
    return {
      success: false,
      id: poolId,
      isSynced: false,
      height: 0,
      targetHeight: 0,
      progress: 0,
      connected: false,
      message: `RPC unavailable - Update Akash deployment to expose port ${config.port}`
    };
  }

  return {
    success: false,
    id: poolId,
    connected: false,
    message: "Synchronizing...",
    isSynced: false,
    progress: 0
  };
});

/**
 * Select the best pool URL (primary or backup) based on RPC sync status.
 * Returns a string like 'stratum+tcp://host:port'
 */
async function selectBestPoolUrl() {
  const {
    primaryPoolHost,
    backupPoolHost,
    primaryRpcHost: rpcHost,
    backupRpcHost: rpcHostBackup,
    primaryRpcPort,
    backupRpcPort,
    primaryStratumPort: stratumPort,
    backupStratumPort: stratumPortBackup
  } = getPoolEnvConfig();

  const primaryUrl = `http://${rpcHost}:${primaryRpcPort}/get_info`;
  const backupUrl = backupRpcPort ? `http://${rpcHostBackup}:${backupRpcPort}/get_info` : null;

  async function probe(url) {
    try {
      const data = await robustGet(url);
      const height = data.height || 0;
      const target = data.target_height || height || 1;
      const progress = target > 0 ? (height / target) * 100 : 0;
      return { ok: true, height, target, progress, url };
    } catch (e) {
      return { ok: false, error: e.message, url };
    }
  }

  const primary = await probe(primaryUrl);
  log('[selectBestPoolUrl] primary probe: ' + JSON.stringify(primary));
  if (primary.ok && primary.progress >= 99.9) {
    const pool = `${primaryPoolHost}:${stratumPort}`;
    log('[selectBestPoolUrl] Selecting PRIMARY pool: ' + pool);
    return `stratum+tcp://${pool}`;
  }

  if (backupUrl && stratumPortBackup) {
    const backup = await probe(backupUrl);
    log('[selectBestPoolUrl] backup probe: ' + JSON.stringify(backup));
    if (backup.ok && backup.progress >= 99.9) {
      const pool = `${backupPoolHost}:${stratumPortBackup}`;
      log('[selectBestPoolUrl] Selecting BACKUP pool: ' + pool);
      return `stratum+tcp://${pool}`;
    }

    if (backup.ok) {
      const pool = `${backupPoolHost}:${stratumPortBackup}`;
      log('[selectBestPoolUrl] Primary unreachable, selecting backup: ' + pool);
      return `stratum+tcp://${pool}`;
    }
  } else {
    log('[selectBestPoolUrl] Backup stratum/RPC not configured; skipping backup');
  }

  if (primary.ok) {
    const pool = `${primaryPoolHost}:${stratumPort}`;
    log('[selectBestPoolUrl] Primary reachable but not fully synced, selecting primary: ' + pool);
    return `stratum+tcp://${pool}`;
  }
  const runtime = getRuntimePool();
  const envPool = runtime?.primary
    ? `${runtime.primary.stratumHost || runtime.primary.host}:${runtime.primary.stratumPort}`
    : (process.env.PRIMARY_POOL_URL || process.env.MB_POOL_URL || 'xmr.minebench.cloud:3333');
  log('[selectBestPoolUrl] Falling back to env/default pool: ' + envPool);
  return envPool.includes('://') ? envPool : `stratum+tcp://${envPool}`;
}

ipcMain.handle("start-benchmark", async (event, { type, wallet, worker, solanaWallet, threads }) => {
  try {
    if (miner) {
      return "Miner already running";
    }

    if (!wallet || !worker) {
      return "Wallet and Worker name are required";
    }

    hashRates = [];
    temps = [];
    powers = [];
    startTime = Date.now();
    currentMinerType = type;

    // Log client/device type selection
    log(`[start-benchmark] ═══════════════════════════════════════════════════════`);
    log(`[start-benchmark] 🖥️  DEVICE TYPE SELECTED: ${type?.toUpperCase() === 'CPU' ? 'CPU' : 'GPU'}`);
    log(`[start-benchmark] 👤 Wallet: ${wallet?.slice(0, 8)}...${wallet?.slice(-8)}`);
    log(`[start-benchmark] 🏷️  Worker: ${worker}`);

    // Get and log CPU capabilities
    const cpuCaps = await getCPUCapabilities();
    log(`[start-benchmark] 💻 CPU Model: ${cpuCaps.model}`);
    log(`[start-benchmark] 🔧 CPU Cores: ${cpuCaps.cores}`);
    log(`[start-benchmark] ⚙️  CPU Features: AES=${cpuCaps.hasAES}, AVX=${cpuCaps.hasAVX}, AVX2=${cpuCaps.hasAVX2}`);

    let minerPath, args;

    if (type === 'gpu') {
      return "GPU mining for Monero is currently not supported in this version.";
      /* 
      // REMOVED RVN/T-Rex support as per v1.0 requirements (XMR Only)
      const workerFormatted = worker.replace(/\s+/g, '-') + "-GPU"; 

      if (app.isPackaged) {
          const exeDir = path.dirname(process.execPath);
          minerDir = path.join(exeDir, "Miner", "T-rex");
          minerPath = path.join(minerDir, "t-rex.exe");
      } else {
          minerDir = path.join(__dirname, "..", "Miner", "T-rex");
          minerPath = path.join(minerDir, "t-rex.exe");
      }

      if (!fs.existsSync(minerPath)) {
          const msg = `T-Rex not found at: ${minerPath}`;
          log(msg);
          return msg;
      }

      args = [
          "-a", "kawpow",
          "-o", "stratum+tcp://rvn.2miners.com:6060",
          "-u", `${wallet}.${workerFormatted}`,
          "--api-bind-http", "127.0.0.1:4067",
          "--api-cors-allow-origin", "*" 
      ];
      
      log(`[start-benchmark] Starting GPU miner: ${minerPath} ${args.join(' ')}`);
      */

    } else {
      const workerFormatted = worker.replace(/\s+/g, '-');

      // Use cross-platform path resolution for Xmrig
      minerPath = await getMinerPath('xmrig');
      minerDir = path.dirname(minerPath);

      // Log which xmrig version is being used
      let xmrigVersion = 'standard (v6.21)';
      let xmrigApiEndpoint = 'http://127.0.0.1:4077/2/summary';
      if (minerPath.includes('/legacy')) {
        xmrigVersion = 'legacy (v5.11/v6.8)';
        xmrigApiEndpoint = 'http://127.0.0.1:4077/api/stats'; // Legacy may use different endpoint
        log(`[start-benchmark] 🔴 XMRIG VERSION: ${xmrigVersion} (API: ${xmrigApiEndpoint})`);
      } else if (minerPath.includes('/compat')) {
        xmrigVersion = 'compat (v6.14)';
        xmrigApiEndpoint = 'http://127.0.0.1:4077/2/summary';
        log(`[start-benchmark] 🟡 XMRIG VERSION: ${xmrigVersion} (API: ${xmrigApiEndpoint})`);
      } else {
        log(`[start-benchmark] 🟢 XMRIG VERSION: ${xmrigVersion} (API: ${xmrigApiEndpoint})`);
      }

      if (!fs.existsSync(minerPath)) {
        const msg = `Xmrig not found at: ${minerPath}`;
        log(msg);
        return msg;
      }

      // Determine best pool URL (primary vs backup) based on RPC sync status
      let poolUrl = await selectBestPoolUrl();
      let finalWallet = wallet;

      if (isPremium && premiumXmrWallet) {
        finalWallet = premiumXmrWallet;
        poolUrl = "pool.supportxmr.com:443";
        log(`[start-benchmark] ⭐ PREMIUM MODE: Mining directly to ${finalWallet} on ${poolUrl}`);
      }

      if (!poolUrl.includes('://')) poolUrl = `stratum+tcp://${poolUrl}`;

      // New architecture: Pass Solana wallet as username to P2Pool
      // P2Pool will use it as worker name in payouts_log.txt
      // wallet parameter is now the application wallet (Monero address)
      // rig-id parameter is Solana address for BMT rewards identification (raw, no encoding)
      args = [
        "--coin", "monero",
        "-o", poolUrl,
        "-u", finalWallet,
        "-p", "x",
        "--rig-id", solanaWallet, // Raw Solana address (no encoding)
        "--http-enabled",
        "--http-host", "127.0.0.1",
        "--http-port", "4077",
        "--donate-level", "1"
      ];

      // Add threads parameter if specified
      if (threads && threads > 0) {
        args.push("-t", threads.toString());
        log(`[start-benchmark] Using ${threads} threads for CPU mining`);
      }

      log(`[start-benchmark] Starting CPU miner (XMR) on ${poolUrl}: ${minerPath} ${args.join(' ')}`);
    }


    // Prepare detailed pre-start diagnostics
    try {
      const stat = fs.statSync(minerPath);
      const size = stat.size;
      const mode = stat.mode;
      let sha256 = null;
      try {
        const createHash = require('crypto').createHash;
        const buf = fs.readFileSync(minerPath);
        sha256 = createHash('sha256').update(buf).digest('hex');
      } catch (e) {
        console.warn('[miner-info] Could not compute checksum:', e.message);
      }

      const minerInfo = {
        path: minerPath,
        exists: true,
        size,
        mode,
        sha256,
        platform: process.platform,
        arch: process.arch,
        isStandardXmrig: !minerPath.includes('/compat') && !minerPath.includes('/legacy'),
        isCompatXmrig: minerPath.includes('/compat'),
        isLegacyXmrig: minerPath.includes('/legacy'),
        version: minerPath.includes('/compat') ? 'compat (v6.14)' : (minerPath.includes('/legacy') ? 'legacy (v5.11/v6.8)' : 'standard (v6.21)')
      };
      log('[miner-info] ' + JSON.stringify(minerInfo));
      if (event?.sender) event.sender.send('miner-info', minerInfo);
    } catch (e) {
      const details = { path: minerPath, error: e.message };
      log('[miner-info] File diagnostic failed: ' + e.message);
      saveIncidentLog('file-diagnostic', details);
      if (event?.sender) event.sender.send('miner-error', `Miner file diagnostic failed: ${e.message}`);
    }

    // Keep small rolling buffers of last stdout/stderr to include in incidents
    let lastStdout = [];
    let lastStderr = [];
    const maxLines = 100;

    // Kill any existing xmrig processes to free up the port
    try {
      if (process.platform === 'win32') {
        require('child_process').execSync('taskkill /F /IM xmrig.exe 2>nul || true', { stdio: 'ignore' });
      } else {
        require('child_process').execSync('pkill -9 xmrig 2>/dev/null || true', { stdio: 'ignore' });
      }
      log('[start-benchmark] 🧹 Cleaned up any existing xmrig processes');
    } catch (e) {
      // Ignore cleanup errors
    }

    // Wait for port to be released
    await new Promise(r => setTimeout(r, 500));

    try {
      log(`[start-benchmark] 🚀 Spawning miner process: ${minerPath}`);
      log(`[start-benchmark] 📝 Arguments: ${args.join(' ')}`);

      miner = spawn(minerPath, args, {
        windowsHide: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        cwd: minerDir
      });

      log(`[start-benchmark] ✅ Miner process spawned with PID: ${miner.pid}`);
      if (event?.sender) event.sender.send('miner-start', { pid: miner.pid });

      // If the binary is removed immediately after spawn (AV/defender), detect it
      setTimeout(() => {
        if (!fs.existsSync(minerPath)) {
          const msg = 'Miner binary missing after spawn — possible antivirus removal';
          log('[miner-incident] ' + msg);
          const incidentPath = saveIncidentLog('binary-removed-after-spawn', { path: minerPath });
          if (event?.sender) event.sender.send('miner-incident', { reason: msg, incidentPath });
        }
      }, 2000);

      miner.stdout.on('data', (data) => {
        const output = data.toString();
        // Keep last lines
        output.split(/\r?\n/).forEach(l => { if (l.trim()) { lastStdout.push(l.trim()); if (lastStdout.length > maxLines) lastStdout.shift(); } });
        log(`${type?.toUpperCase() || 'MINER'} stdout: ${output}`);
        if (event?.sender) event.sender.send('miner-log', output);

        if (currentMinerType === 'cpu') {
          si.cpuTemperature().then(tempData => {
            if (tempData.main !== null) temps.push(tempData.main);
          }).catch(() => { });
        }
      });

      miner.stderr.on('data', (data) => {
        const error = data.toString();
        error.split(/\r?\n/).forEach(l => { if (l.trim()) { lastStderr.push(l.trim()); if (lastStderr.length > maxLines) lastStderr.shift(); } });
        log(`${type?.toUpperCase() || 'MINER'} stderr: ${error}`);
        if (event?.sender) event.sender.send('miner-error', error);
      });

      miner.on('error', (err) => {
        const errDetails = { message: err.message, code: err.code || null, errno: err.errno || null, syscall: err.syscall || null };
        log(`${type?.toUpperCase() || 'MINER'} error: ${JSON.stringify(errDetails)}`);

        // Special handling for EPERM (Windows Defender blocking): save incident
        if (err.code === 'EPERM') {
          log('[miner-error] EPERM detected — likely antivirus blocking. Binary path: ' + minerPath);
          saveIncidentLog('spawn-eperm-antivirus', { path: minerPath, error: errDetails, code: err.code });
        } else {
          saveIncidentLog('spawn-error', { path: minerPath, args, error: errDetails, lastStdout, lastStderr });
        }

        miner = null;
        if (event?.sender) {
          event.sender.send('miner-error', { message: String(err), code: err.code || null, incidentPath: minerPath });
        }
      });

      miner.on('close', (code, signal) => {
        log(`${type?.toUpperCase() || 'MINER'} exited: code=${code}, signal=${signal}`);
        const incident = { path: minerPath, code, signal, lastStdout: lastStdout.slice(-20), lastStderr: lastStderr.slice(-20) };
        if (code !== 0) {
          const incidentPath = saveIncidentLog('nonzero-exit', incident);
          if (event?.sender) event.sender.send('miner-incident', { code, signal, incidentPath });
        }
        miner = null;
        if (event?.sender) event.sender.send('miner-exit', { code, signal });
      });
    } catch (err) {
      const errDetails = { message: err.message, stack: err.stack };
      log('[start-benchmark] Spawn failed: ' + err.message);
      saveIncidentLog('spawn-failed', { path: minerPath, args, error: errDetails });
      if (event?.sender) event.sender.send('miner-error', `Spawn failed: ${err.message}`);
      miner = null;
    }

    return "benchmark running";
  } catch (err) {
    const msg = `Error: ${err?.message ?? String(err)}`;
    log(msg);
    log(`Full error object: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    return msg;
  }
});

ipcMain.handle("stop-benchmark", async (event, benchmarkData) => {
  console.log('[stop-benchmark] Received data:', benchmarkData);
  const avgHash = benchmarkData?.avg_hashrate ?? null;
  const maxHash = benchmarkData?.max_hashrate ?? null;
  const walletAddress = benchmarkData?.wallet ?? null;

  console.log('[stop-benchmark] Parsed values:', { avgHash, maxHash, walletAddress });

  try {
    if (miner) {
      miner.kill();
      miner = null;
    }

    const duration_seconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;

    let benchmarkRecord = {
      avg_hashrate: avgHash,
      max_hashrate: maxHash,
      duration_seconds
    };

    if (currentMinerType === 'gpu') {
      let gpuName = "Unknown GPU";
      try {
        const graphics = await si.graphics();
        if (graphics.controllers.length > 0) {
          gpuName = graphics.controllers[0].model;
        }
      } catch (e) { console.error("Could not get GPU info", e); }

      benchmarkRecord = {
        ...benchmarkRecord,
        device_type: "GPU",
        device_name: gpuName,
        avg_temp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
        avg_power: powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : null,
        algorithm: "KawPow",
        coin_name: "XMR",
        solana_wallet_address: walletAddress
      };
    } else {
      benchmarkRecord = {
        ...benchmarkRecord,
        device_type: "CPU",
        device_name: os.cpus()[0].model,
        avg_temp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
        algorithm: "RandomX",
        coin_name: "XMR",
        solana_wallet_address: walletAddress
      };
    }

    const result = await sendToDatabase({
      ...benchmarkRecord,
      device_uid: deviceUID,
      created_at: new Date().toISOString()
    });

    console.log('[stop-benchmark] Database result:', result);

    if (result.success) {
      log("✅ Benchmark data saved successfully.");
      return "Benchmark stopped and data saved";
    } else {
      log(`❌ Failed to save benchmark data: ${result.error}`);
      return `Benchmark stopped, but save failed: ${result.error}`;
    }
  } catch (err) {
    console.error('[stop-benchmark] Error:', err);
    log(`❌ Error during stop-benchmark: ${err.message}`);
    return `Error: ${err.message}`;
  }
});

// Fetch latest benchmark for device from Supabase
ipcMain.handle('get-latest-benchmark', async (event, deviceType) => {
  try {
    const { data, error } = await supabase
      .from('benchmarks')
      .select('avg_hashrate, created_at')
      .eq('device_uid', deviceUID)
      .eq('device_type', deviceType.toUpperCase())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.warn('[get-latest-benchmark] DB error:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[get-latest-benchmark] Error:', err);
    return null;
  }
});

// Mining-only controls: start/stop without saving benchmark to DB
ipcMain.handle("start-mining", async (event, { type, wallet, worker, threads, poolUrl, manualPoolSelection, donateLevel, cpuPriority, randomxMode, hugePages, solanaWallet }) => {
  try {
    if (miner) {
      return "Miner already running";
    }

    if (!wallet || !worker) {
      return "Wallet and Worker name are required";
    }

    hashRates = [];
    temps = [];
    powers = [];
    startTime = Date.now();
    currentMinerType = type;

    // Log client/device type selection
    log(`[start-mining] ═══════════════════════════════════════════════════════`);
    log(`[start-mining] 🖥️  DEVICE TYPE SELECTED: ${type?.toUpperCase() === 'CPU' ? 'CPU' : 'GPU'}`);
    log(`[start-mining] 👤 Wallet: ${wallet?.slice(0, 8)}...${wallet?.slice(-8)}`);
    log(`[start-mining] 🏷️  Worker: ${worker}`);

    // Get and log CPU capabilities
    const cpuCaps = await getCPUCapabilities();
    log(`[start-mining] 💻 CPU Model: ${cpuCaps.model}`);
    log(`[start-mining] 🔧 CPU Cores: ${cpuCaps.cores}`);
    log(`[start-mining] ⚙️  CPU Features: AES=${cpuCaps.hasAES}, AVX=${cpuCaps.hasAVX}, AVX2=${cpuCaps.hasAVX2}`);

    let minerPath, args;

    if (type === 'gpu') {
      return "GPU mining for Monero is currently not supported in this version.";
    } else {
      const workerFormatted = worker.replace(/\s+/g, '-');
      minerPath = await getMinerPath('xmrig');
      minerDir = path.dirname(minerPath);

      // Log which xmrig version is being used for mining
      let xmrigVersion = 'standard (v6.21)';
      let xmrigApiEndpoint = 'http://127.0.0.1:4077/2/summary';
      if (minerPath.includes('/legacy')) {
        xmrigVersion = 'legacy (v5.11/v6.8)';
        xmrigApiEndpoint = 'http://127.0.0.1:4077/api/stats';
        log(`[start-mining] 🔴 XMRIG VERSION: ${xmrigVersion} (API: ${xmrigApiEndpoint})`);
      } else if (minerPath.includes('/compat')) {
        xmrigVersion = 'compat (v6.14)';
        xmrigApiEndpoint = 'http://127.0.0.1:4077/2/summary';
        log(`[start-mining] 🟡 XMRIG VERSION: ${xmrigVersion} (API: ${xmrigApiEndpoint})`);
      } else {
        log(`[start-mining] 🟢 XMRIG VERSION: ${xmrigVersion} (API: ${xmrigApiEndpoint})`);
      }

      if (!fs.existsSync(minerPath)) {
        const msg = `Xmrig not found at: ${minerPath}`;
        log(msg);
        return msg;
      }

      // Backend runtime config has priority. User/local pool URL is fallback only.
      if (!getRuntimePool()) {
        await loadRemotePoolConfig();
      }

      let finalPoolUrl;
      if (getRuntimePool()?.primary) {
        finalPoolUrl = await selectBestPoolUrl();
        log(`[start-mining] Using backend runtime pool config: ${finalPoolUrl}`);
      } else if (manualPoolSelection && poolUrl) {
        finalPoolUrl = poolUrl;
        log(`[start-mining] Backend pool config unavailable, using MANUAL local fallback: ${finalPoolUrl}`);
      } else {
        finalPoolUrl = await selectBestPoolUrl();
        log(`[start-mining] Backend pool config unavailable, using env/default auto pool: ${finalPoolUrl}`);
      }
      if (!finalPoolUrl.includes('://')) finalPoolUrl = `stratum+tcp://${finalPoolUrl}`;

      const finalCpuPriority = cpuPriority !== undefined ? cpuPriority : 2;
      const finalRandomxMode = randomxMode || 'auto';
      const finalHugePages = hugePages !== undefined ? hugePages : true;

      // New architecture: Pass Solana wallet as username to P2Pool
      // wallet parameter is now the application wallet (Monero address)
      // rig-id parameter is Solana address for BMT rewards identification (raw, no encoding)
      args = [
        "--coin", "monero",
        "-o", finalPoolUrl,
        "-u", wallet,
        "-p", "x",
        "--rig-id", solanaWallet, // Raw Solana address (no encoding)
        "--http-enabled",
        "--http-host", "127.0.0.1",
        "--http-port", "4077",
        "--donate-level", String(Math.max(0, Math.min(5, Number(donateLevel) || 0))),
        "--cpu-priority", finalCpuPriority.toString(),
        "--randomx-mode", finalRandomxMode
      ];

      // Add huge pages flag if enabled
      if (finalHugePages) {
        args.push("--randomx-1gb-pages");
      }

      if (threads && threads > 0) {
        args.push("-t", threads.toString());
        log(`[start-mining] Using ${threads} threads for CPU mining`);
      }

      log(`[start-mining] Starting CPU miner (XMR) on ${finalPoolUrl} | Priority: ${finalCpuPriority} | Mode: ${finalRandomxMode} | Huge Pages: ${finalHugePages}`);
    }


    // Diagnostics and enhanced logging for mining spawn
    let lastStdout = [];
    let lastStderr = [];
    const maxLines = 100;

    try {
      try {
        const stat = fs.statSync(minerPath);
        const size = stat.size;
        let sha256 = null;
        try { sha256 = require('crypto').createHash('sha256').update(fs.readFileSync(minerPath)).digest('hex'); } catch (e) { }
        if (event?.sender) event.sender.send('miner-info', { path: minerPath, size, sha256, platform: process.platform, arch: process.arch });
        log('[miner-info] ' + minerPath + ' size=' + size + ' sha256=' + (sha256 || 'n/a'));
      } catch (e) {
        log('[miner-info] diagnostic failed: ' + e.message);
      }

      // Kill any existing xmrig processes to free up the port
      try {
        if (process.platform === 'win32') {
          require('child_process').execSync('taskkill /F /IM xmrig.exe 2>nul || true', { stdio: 'ignore' });
        } else {
          require('child_process').execSync('pkill -9 xmrig 2>/dev/null || true', { stdio: 'ignore' });
        }
        log('[start-mining] 🧹 Cleaned up any existing xmrig processes');
      } catch (e) {
        // Ignore cleanup errors
      }

      // Wait for port to be released
      await new Promise(r => setTimeout(r, 500));

      miner = spawn(minerPath, args, {
        windowsHide: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        cwd: minerDir
      });

      if (event?.sender) event.sender.send('miner-start', { pid: miner.pid });

      setTimeout(() => {
        if (!fs.existsSync(minerPath)) {
          const msg = 'Miner binary missing after spawn — possible antivirus removal';
          log('[miner-incident] ' + msg);
          const incidentPath = saveIncidentLog('binary-removed-after-spawn', { path: minerPath });
          if (event?.sender) event.sender.send('miner-incident', { reason: msg, incidentPath });
        }
      }, 2000);

      miner.stdout.on('data', (data) => {
        const output = data.toString();
        output.split(/\r?\n/).forEach(l => { if (l.trim()) { lastStdout.push(l.trim()); if (lastStdout.length > maxLines) lastStdout.shift(); } });
        log(`${type?.toUpperCase() || 'MINER'} stdout: ${output}`);
        if (event?.sender) event.sender.send('miner-log', output);
      });

      miner.stderr.on('data', (data) => {
        const output = data.toString();
        output.split(/\r?\n/).forEach(l => { if (l.trim()) { lastStderr.push(l.trim()); if (lastStderr.length > maxLines) lastStderr.shift(); } });
        log(`${type?.toUpperCase() || 'MINER'} stderr: ${output}`);
        if (event?.sender) event.sender.send('miner-error', output);
      });

      miner.on('error', (err) => {
        const errDetails = { message: err.message, code: err.code || null, errno: err.errno || null };
        log('[miner] spawn error: ' + JSON.stringify(errDetails));

        // Special handling for EPERM (Windows Defender blocking)
        if (err.code === 'EPERM') {
          log('[miner-error] EPERM detected — likely antivirus blocking. Binary path: ' + minerPath);
          saveIncidentLog('spawn-eperm-antivirus', { path: minerPath, error: errDetails, code: err.code });
        } else {
          saveIncidentLog('spawn-error', { path: minerPath, args, error: errDetails, lastStdout, lastStderr });
        }

        miner = null;
        if (event?.sender) event.sender.send('miner-error', { message: String(err), code: err.code });
      });

      miner.on('close', (code, signal) => {
        log(`${type?.toUpperCase() || 'MINER'} exited: code=${code}, signal=${signal}`);
        const incident = { path: minerPath, code, signal, lastStdout: lastStdout.slice(-20), lastStderr: lastStderr.slice(-20) };
        if (code !== 0) {
          const incidentPath = saveIncidentLog('nonzero-exit', incident);
          if (event?.sender) event.sender.send('miner-incident', { code, signal, incidentPath });
        }
        miner = null;
        if (event?.sender) event.sender.send('miner-exit', { code, signal });
      });
    } catch (err) {
      log('[start-mining] Spawn failed: ' + err.message);
      saveIncidentLog('spawn-failed', { path: minerPath, args, error: { message: err.message, stack: err.stack } });
      if (event?.sender) event.sender.send('miner-error', `Spawn failed: ${err.message}`);
      miner = null;
    }

    return "mining running";
  } catch (err) {
    const msg = `Error: ${err?.message ?? String(err)}`;
    log(msg);
    log(`Full error object: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    return msg;
  }
});

ipcMain.handle("stop-mining", async (event) => {
  try {
    if (miner) {
      miner.kill();
      miner = null;
    }
    return "Mining stopped";
  } catch (err) {
    log(`❌ Error during stop-mining: ${err.message}`);
    return `Error: ${err.message}`;
  }
});

ipcMain.handle("pause-mining", async (event) => {
  try {
    if (miner && miner.pid) {
      // SIGSTOP pauses the process
      process.kill(miner.pid, 'SIGSTOP');
      log(`[pause-mining] Paused mining process ${miner.pid}`);
      return "Mining paused";
    }
    return "No mining process to pause";
  } catch (err) {
    log(`❌ Error during pause-mining: ${err.message}`);
    return `Error: ${err.message}`;
  }
});

ipcMain.handle("resume-mining", async (event) => {
  try {
    if (miner && miner.pid) {
      // SIGCONT resumes the paused process
      process.kill(miner.pid, 'SIGCONT');
      log(`[resume-mining] Resumed mining process ${miner.pid}`);
      return "Mining resumed";
    }
    return "No mining process to resume";
  } catch (err) {
    log(`❌ Error during resume-mining: ${err.message}`);
    return `Error: ${err.message}`;
  }
});



let mainWindow = null;


function getAppIcon() {
  const isWindows = process.platform === 'win32';
  const iconFile = isWindows ? 'icon.ico' : 'icon.png';
  let iconPath = null;

  if (app.isPackaged) {
    const possiblePaths = [
      path.join(app.getAppPath(), '..', 'build', iconFile),
      path.join(app.getAppPath(), 'build', iconFile),
      path.join(process.resourcesPath, 'build', iconFile)
    ];

    iconPath = possiblePaths.find(p => fs.existsSync(p)) || null;
    if (!iconPath) {
      console.warn(`Icon file not found in packaged locations: ${possiblePaths.join(', ')}`);
      return undefined;
    }
  } else {
    iconPath = path.join(__dirname, '..', 'build', iconFile);
    if (!fs.existsSync(iconPath)) {
      console.warn(`Icon file not found in development at: ${iconPath}`);
      return undefined;
    }
  }

  return iconPath;
}

function log(message) {
  try {
    const ts = new Date().toISOString();
    const line = `${ts} ${typeof message === 'string' ? message : JSON.stringify(message)}
`;
    console.log(line.trim());

    try { if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true }); } catch (e) { }

    try {
      const date = new Date().toISOString().slice(0, 10);
      const appLog = path.join(logsDir, `app-${date}.log`);
      fs.appendFileSync(appLog, line, 'utf8');
    } catch (err) {
      console.error('[log] Failed to write to app log:', err.message);
    }
  } catch (err) {
    try { console.log(new Date().toISOString(), message); } catch (e) { }
  }
}

function createWindow() {
  try {
    const isWindows = process.platform === 'win32';
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 700,
      frame: false,
      ...(isWindows
        ? {
          titleBarOverlay: {
            color: '#020408',
            symbolColor: '#a1a1aa',
            height: 32
          }
        }
        : {}),
      backgroundColor: '#020408',
      icon: getAppIcon(),
      useContentSize: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: path.join(__dirname, "preload.cjs"),
        enableRemoteModule: false,
      },
    });

    if (app.isPackaged) {
      const indexPath = path.join(app.getAppPath(), "web-dist", "index.html");
      if (indexPath) {
        log(`[createWindow] ? Found index.html at: ${indexPath}`);
        mainWindow.loadFile(indexPath).catch((err) => {
          log(`[createWindow] ? loadFile error: ${err}`);
          mainWindow.webContents.openDevTools();
        });
      } else {
        log(`[createWindow] ? No index.html found in packaged app`);
        mainWindow.loadURL("data:text/html,<h2 style='font-family:sans-serif;color:#c00'>index.html not found</h2>");
        mainWindow.webContents.openDevTools();
      }
    } else {
      mainWindow.loadURL("http://localhost:5173");
      mainWindow.webContents.openDevTools();
    }

    log(`[createWindow] ? Window created successfully on ${process.platform}`);
    if (displayStatus.displayInfo) {
      log(`[createWindow] ${displayStatus.displayInfo}`);
    }
  } catch (err) {
    log(`[createWindow] ? Fatal error creating window: ${err.message}`);
    if (mainWindow) {
      const errorHTML = `
        <html>
          <head>
            <style>
              body { 
                font-family: sans-serif; 
                padding: 40px; 
                background: #020408; 
                color: #e0e0e0;
              }
              h1 { color: #ef4444; margin-top: 0; }
              .warning { 
                background: #1f2937; 
                padding: 20px; 
                border-radius: 8px; 
                border-left: 4px solid #ef4444;
              }
              code { 
                background: #111827; 
                padding: 2px 6px; 
                border-radius: 3px; 
                font-family: monospace;
              }
              .hint {
                margin-top: 20px;
                padding: 15px;
                background: #1e3a8a;
                border-radius: 6px;
              }
            </style>
          </head>
          <body>
            <div class='warning'>
              <h1>Startup error</h1>
              <p>${err.message}</p>
            </div>
          </body>
        </html>`;
      mainWindow.loadURL('data:text/html,' + encodeURIComponent(errorHTML));
      mainWindow.webContents.openDevTools();
    }
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
