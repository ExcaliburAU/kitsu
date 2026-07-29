const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('relayDesktop', {
  platform: process.platform,
  isDesktop: true,
  getAppInfo: () => ipcRenderer.invoke('relay:app-info'),
  openSource: () => ipcRenderer.invoke('relay:open-source'),
  getProtocolStatus: () => ipcRenderer.invoke('relay:protocol-status'),
  repairProtocol: () => ipcRenderer.invoke('relay:protocol-repair'),
  windowAction: (action) => ipcRenderer.invoke('relay:window-action', action),
  isWindowFocused: () => ipcRenderer.invoke('relay:window-focused'),
  setSpellcheck: (enabled) => ipcRenderer.invoke('relay:set-spellcheck', Boolean(enabled)),
  getSpellcheck: () => ipcRenderer.invoke('relay:get-spellcheck'),
  showNotification: (payload) => ipcRenderer.invoke('relay:show-notification', payload),
  clearNotifications: (payload) => ipcRenderer.invoke('relay:clear-notifications', payload || {}),
  onNotificationClick: (callback) => {
    const handler = (_event, data) => {
      if (typeof callback === 'function') callback(data);
    };
    ipcRenderer.on('relay:notification-click', handler);
    return () => ipcRenderer.removeListener('relay:notification-click', handler);
  },
  onProtocolOpen: (callback) => {
    const handler = (_event, data) => {
      if (typeof callback === 'function') callback(data);
    };
    ipcRenderer.on('relay:protocol-open', handler);
    return () => ipcRenderer.removeListener('relay:protocol-open', handler);
  },
});
