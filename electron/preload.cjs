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
  getDisplayStatus: () => ipcRenderer.invoke('get-display-status')
});