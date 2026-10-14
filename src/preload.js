const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sidebarAPI', {
  getState: () => ipcRenderer.invoke('sidebar:get-state'),
  getUpdates: () => ipcRenderer.invoke('sidebar:updates-get'),
  checkUpdates: () => ipcRenderer.invoke('sidebar:updates-check'),
  setUpdatePreferences: (prefs) => ipcRenderer.invoke('sidebar:updates-set-preferences', prefs),
  postponeUpdate: () => ipcRenderer.invoke('sidebar:updates-later'),
  downloadUpdate: () => ipcRenderer.invoke('sidebar:updates-download'),
  installUpdate: () => ipcRenderer.invoke('sidebar:updates-install'),
  openReleases: () => ipcRenderer.invoke('sidebar:updates-open-releases'),
  navigate: (action) => ipcRenderer.invoke('sidebar:navigate', action),
  selectSite: (siteId) => ipcRenderer.invoke('sidebar:select-site', siteId),
  toggleExpanded: () => ipcRenderer.invoke('sidebar:toggle-expanded'),
  hideWindow: () => ipcRenderer.invoke('sidebar:hide-window'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('sidebar:toggle-always-on-top'),
  toggleSide: () => ipcRenderer.invoke('sidebar:toggle-side'),
  toggleDocked: () => ipcRenderer.invoke('sidebar:toggle-docked'),
  setPanelWidth: (width, persist = false) => ipcRenderer.invoke('sidebar:set-panel-width', width, persist),
  setSettingsOpen: (isOpen) => ipcRenderer.invoke('sidebar:set-settings-open', isOpen),
  saveSettings: (settings) => ipcRenderer.invoke('sidebar:save-settings', settings),
  onStateUpdated: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('sidebar:state-updated', listener);
    return () => ipcRenderer.removeListener('sidebar:state-updated', listener);
  },
  onUpdatesState: (callback) => {
    const listener = (_event, update) => callback(update);
    ipcRenderer.on('sidebar:updates-state', listener);
    return () => ipcRenderer.removeListener('sidebar:updates-state', listener);
  },
  onNavigationUpdated: (callback) => {
    const listener = (_event, navigation) => callback(navigation);
    ipcRenderer.on('sidebar:navigation-updated', listener);
    return () => ipcRenderer.removeListener('sidebar:navigation-updated', listener);
  }
});
