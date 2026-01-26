const fs = require("fs");
const { spawn } = require("child_process");
const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const si = require('systeminformation');
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');
const deviceIdFile = path.join(app.getPath('userData'), 'device_id.txt');
const os = require('os');

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
const supabase = createClient('https://your-project-ref.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1td3R1eWxscHRrZWxjZnVqYW9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NDA2ODIsImV4cCI6MjA3NjUxNjY4Mn0.your_supabase_anon_key_here')
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

ipcMain.handle('get-cpu-cores', () => {
  return os.cpus().length;
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

ipcMain.handle('get-cpu-temp', async () => {
  try {
    const tempData = await si.cpuTemperature();
    if (tempData.main === null) {
      return { success: false, temp: null, message: 'Cannot read CPU temperature' };
    }
    return { success: true, temp: tempData.main };
  } catch (err) {
    console.error('Error reading CPU temp:', err);
    return { success: false, temp: null, message: 'Error reading CPU temperature' };
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

// Expose display status to renderer
ipcMain.handle('get-display-status', () => {
  return displayStatus;
});

const { exec } = require('child_process');
const http = require('http');

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

ipcMain.handle('get-pool-sync', async (event, poolId) => {
    // Mapping IDs to their RPC ports
    // Development: Local Docker containers with mapped RPC ports
    // Production: MineBench Cloud node deployed on Akash (xmr.minebench.cloud)
    // NOTE: RPC port 18081 is forwarded on Akash; keep this in sync with current lease
    const rpcHost = process.env.MB_RPC_HOST || 'xmr.minebench.cloud';
    const rpcPort = Number(process.env.MB_RPC_PORT) || 30595;

    const poolConfigs = {
        'cpu': { 
          host: rpcHost,
          port: rpcPort, // Akash forwarded port for 18081 RPC
          container: 'minebench-monerod' 
        },
        'gpu': { 
          host: rpcHost,
          port: rpcPort, // Same RPC endpoint
          container: 'minebench-gpu-node' 
        }
    };

    const config = poolConfigs[poolId] || poolConfigs['cpu'];
    const urls = [`http://${config.host}:${config.port}/get_info`];
    
    // Спробуємо отримати свіжі дані
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
            
            // Зберігаємо успішний статус в кеш
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
             
             // Зберігаємо успішний статус в кеш
             poolStatusCache.set(poolId, successStatus);
             
             return successStatus;
        }
    } catch(e) {
        console.error(`[get-pool-sync][${poolId}] JSON-RPC Error: ${e.message}`);
    }

    // FINAL FALLBACK: Parse Docker Logs directly (only for local dev)
    // For remote pool on Akash, we can't access container logs
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

    // Якщо всі спроби не вдалися, повертаємо закешований статус (якщо є)
    const cachedStatus = poolStatusCache.get(poolId);
    if (cachedStatus) {
        console.log(`[get-pool-sync][${poolId}] Using cached status: ${cachedStatus.progress.toFixed(1)}%`);
        return {
            ...cachedStatus,
            connected: false, // Позначаємо що зараз не з'єднані
            message: "Using cached data"
        };
    }

    // For production Akash pool: Show actual RPC status
    // If RPC is unavailable, indicate unknown status but allow mining
    if (config.host === 'xmr.minebench.cloud') {
        return {
            success: false,
            id: poolId,
            isSynced: false,
            height: 0,
            targetHeight: 0,
            progress: 0,
            connected: false,
            message: "RPC unavailable - Update Akash deployment to expose port 18081"
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

let mainWindow = null;

function log(message) {
  console.log(new Date().toISOString(), message);
}

function getAppIcon() {
  const isWindows = process.platform === 'win32';
  const iconFile = isWindows ? 'icon.ico' : 'icon.png';
  const baseDir = app.isPackaged ? app.getAppPath() : path.join(__dirname, '..');
  return path.join(baseDir, 'build', iconFile);
}

function createWindow() {
  try {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 1000,
      minHeight: 700,
      frame: false,
      backgroundColor: '#020408',
      icon: getAppIcon(),
      // Wayland-specific options for better compatibility
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
        log(`[createWindow] ✅ Found index.html at: ${indexPath}`);
        mainWindow.loadFile(indexPath).catch((err) => {
          log(`[createWindow] ❌ loadFile error: ${err}`);
          mainWindow.webContents.openDevTools();
        });
      } else {
        log(`[createWindow] ❌ No index.html found in packaged app`);
        mainWindow.loadURL("data:text/html,<h2 style='font-family:sans-serif;color:#c00'>index.html not found</h2>");
        mainWindow.webContents.openDevTools();
      }
    } else {
      mainWindow.loadURL("http://localhost:5173");
      mainWindow.webContents.openDevTools();
    }

    // Log successful window creation
    log(`[createWindow] ✅ Window created successfully on ${process.platform}`);
    if (displayStatus.displayInfo) {
      log(`[createWindow] ${displayStatus.displayInfo}`);
    }
  } catch (err) {
    log(`[createWindow] ❌ Fatal error creating window: ${err.message}`);
    // Attempt fallback: headless mode or data URL with error message
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
            <h1>⚠️ Display Error</h1>
            <div class="warning">
              <p><strong>Error:</strong> ${err.message}</p>
              <p><strong>Platform:</strong> ${process.platform}</p>
              ${displayStatus.displayWarnings.length > 0 ? `<p><strong>Issues detected:</strong><ul>${displayStatus.displayWarnings.map(w => `<li>${w}</li>`).join('')}</ul></p>` : ''}
            </div>
            <div class="hint">
              <p><strong>Solution for Linux users:</strong></p>
              <ul>
                <li>Run without <code>sudo</code>: <code>./MineBench\ Client-0.3.0.AppImage</code></li>
                <li>Ensure X11 or Wayland is available</li>
                <li>Check DISPLAY environment: <code>echo $DISPLAY</code></li>
              </ul>
            </div>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(errorHTML)}`);
    }
  }
}

/**
 * Отримати шлях до правильного бінарника для поточної ОС
 * @param {string} minerName - назва майнера ('xmrig' або 't-rex')
 * @returns {string} шлях до бінарника
 */
function getMinerPath(minerName) {
    // Визначити поточну платформу та архітектуру
    const platform = process.platform; // 'win32', 'darwin', 'linux'
    const arch = process.arch; // 'x64', 'arm64', тощо
    
    // Маппінг платформ на назви директорій
    let platformDir;
    let exeExt = '';
    
    if (platform === 'win32') {
        // Windows: підтримувати x64 та arm64
        platformDir = arch === 'arm64' ? 'win-arm64' : 'win-x64';
        exeExt = '.exe';
    } else if (platform === 'darwin') {
        // macOS: підтримувати x64 та arm64 (Apple Silicon)
        platformDir = arch === 'arm64' ? 'macos-arm64' : 'macos-x64';
    } else if (platform === 'linux') {
        platformDir = 'linux-x64';
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }
    
    const minerExe = `${minerName}${exeExt}`;
    
    if (app.isPackaged) {
        // У запакованому додатку Miner знаходиться поруч з executable
        const resourcesPath = path.dirname(process.execPath);
        return path.join(resourcesPath, 'Miner', minerName, platformDir, minerExe);
    } else {
        // У development режимі
        return path.join(__dirname, '..', 'Miner', minerName, platformDir, minerExe);
    }
}

ipcMain.handle("start-benchmark", async (event, { type, wallet, worker, threads }) => {
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
        minerPath = getMinerPath('xmrig');

        if (!fs.existsSync(minerPath)) {
            const msg = `Xmrig not found at: ${minerPath}`;
            log(msg);
            return msg;
        }

        // Configuration for MineBench Private Pool (Monero/XMR)
        // Development: Connects to local P2Pool instance (127.0.0.1:3333)
        // Production: MineBench Cloud P2Pool (deployed on Akash)
        const poolUrl = process.env.MB_POOL_URL || "xmr.minebench.cloud:30832"; 

        args = [
            "--coin", "monero",
            "-o", poolUrl,
            "-u", wallet,
            "-p", workerFormatted, 
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

    miner = spawn(minerPath, args, {
      windowsHide: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false,
      cwd: minerDir
    });

    miner.stdout.on("data", (data) => {
      const output = data.toString();
      log(`${type?.toUpperCase() || 'MINER'} stdout: ${output}`);
      if (event?.sender) event.sender.send("miner-log", output);

      if (currentMinerType === 'cpu') {
          si.cpuTemperature().then(tempData => {
            if (tempData.main !== null) temps.push(tempData.main);
          });
      }
    });

    miner.stderr.on("data", (data) => {
      const error = data.toString();
      log(`${type?.toUpperCase() || 'MINER'} stderr: ${error}`);
      if (event?.sender) event.sender.send("miner-error", error);
    });

    miner.on("error", (err) => {
      log(`${type?.toUpperCase() || 'MINER'} error: ${err}`);
      miner = null;
      if (event?.sender) event.sender.send("miner-error", String(err));
    });

    miner.on("close", (code, signal) => {
      log(`${type?.toUpperCase() || 'MINER'} exited: code=${code}, signal=${signal}`);
      miner = null;
      if (event?.sender) event.sender.send("miner-exit", { code, signal });
    });

    return "benchmark running";
  } catch (err) {
    const msg = `Error: ${err?.message ?? String(err)}`;
    log(msg);
    log(`Full error object: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
    return msg;
  }
});

ipcMain.handle("stop-benchmark", async (event, benchmarkData) => {
  const avgHash = benchmarkData.avg_hashrate ?? null;
  const maxHash = benchmarkData.max_hashrate ?? null;
  try {
    if (miner) {
      miner.kill();
      miner = null;
    }

    const duration_seconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : null;
    
    let benchmarkRecord = {
        avg_hashrate: avgHash,
        max_hashrate: maxHash,
        duration_seconds,
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
            coin_name: "RVN"
        };
    } else {
        benchmarkRecord = {
             ...benchmarkRecord,
             device_type: "CPU",
             device_name: os.cpus()[0].model,
             avg_temp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : null,
             algorithm: "RandomX",
             coin_name: "ZEPH"
        };
    }

    const result = await sendToDatabase({
      ...benchmarkRecord,
      device_uid: deviceUID,
      created_at: new Date().toISOString()
    });

    if (result.success) {
      log("✅ Benchmark data saved successfully.");
      return "Benchmark stopped and data saved";
    } else {
      log(`❌ Failed to save benchmark data: ${result.error}`);
      return `Benchmark stopped, but save failed: ${result.error}`;
    }
  } catch (err) {
    log(`❌ Error during stop-miner: ${err.message}`);
    return `Error: ${err.message}`;
  }
});

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
