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
  // Get display/environment status
  getDisplayStatus: () => ipcRenderer.invoke('get-display-status'),
  
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