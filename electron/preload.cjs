const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nexusDesktop', {
  isDesktop: true,
  platform: process.platform,
  cloneRepo: (url, branch) => ipcRenderer.invoke('nexus:clone', url, branch),
  pickFolder: () => ipcRenderer.invoke('nexus:pickFolder'),
  scanFolder: (dir) => ipcRenderer.invoke('nexus:scan', dir),
  writeFile: (absPath, content) => ipcRenderer.invoke('nexus:writeFile', absPath, content),
  openPath: (p) => ipcRenderer.invoke('nexus:openPath', p),
  onProgress: (cb) => {
    const handler = (_e, msg) => cb(msg);
    ipcRenderer.on('nexus:progress', handler);
    return () => ipcRenderer.removeListener('nexus:progress', handler);
  },
});
