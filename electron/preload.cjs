const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, func) => {
    const subscription = (event, ...args) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => ipcRenderer.removeListener(channel, subscription);
  },
  onMinerLog: (callback) => {
    ipcRenderer.on("miner-log", callback);
    return () => ipcRenderer.removeListener("miner-log", callback);
  },
  onMinerError: (callback) => {
    ipcRenderer.on("miner-error", callback);
    return () => ipcRenderer.removeListener("miner-error", callback);
  },
  onMinerExit: (callback) => {
    ipcRenderer.on("miner-exit", callback);
    return () => ipcRenderer.removeListener("miner-exit", callback);
  },
  onMinerInfo: (callback) => {
    ipcRenderer.on("miner-info", (event, data) => callback(data));
    return () => ipcRenderer.removeListener("miner-info", callback);
  },
  onMinerStart: (callback) => {
    ipcRenderer.on("miner-start", (event, data) => callback(data));
    return () => ipcRenderer.removeListener("miner-start", callback);
  },
  onMinerIncident: (callback) => {
    ipcRenderer.on("miner-incident", (event, data) => callback(data));
    return () => ipcRenderer.removeListener("miner-incident", callback);
  },
  // Get display/environment status
  getDisplayStatus: () => ipcRenderer.invoke('get-display-status'),
  
  // Log to system log file from renderer process
  logToFile: (level, message, source = 'UI') => 
    ipcRenderer.invoke('log-to-file', { level, message, source }),

  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // Solana wallet IPC - expose ipcRenderer for wallet operations
  ipcRenderer: {
    invoke: (channel, ...args) => {
      // Whitelist allowed channels for security
      const validChannels = [
        'solana-connect-wallet',
        'solana-disconnect-wallet',
        'solana-get-token-balance',
        'p2pool-rpc-call'
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      throw new Error(`Invalid IPC channel: ${channel}`);
    }
  }
});
