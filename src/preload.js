const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sidebarAPI', {
  getState: () => ipcRenderer.invoke('sidebar:get-state'),
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
  onNavigationUpdated: (callback) => {
    const listener = (_event, navigation) => callback(navigation);
    ipcRenderer.on('sidebar:navigation-updated', listener);
    return () => ipcRenderer.removeListener('sidebar:navigation-updated', listener);
  }
});
