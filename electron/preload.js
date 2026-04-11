const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tinyflowEnv', {
  desktop: true,
});

contextBridge.exposeInMainWorld('tinyflowDesktop', {
  snapToCorner(corner) {
    return ipcRenderer.invoke('tinyflow:snap-corner', corner);
  },
  windowControl(action) {
    return ipcRenderer.invoke('tinyflow:window-control', action);
  },
  togglePin() {
    return ipcRenderer.invoke('tinyflow:toggle-pin');
  },
  getPinState() {
    return ipcRenderer.invoke('tinyflow:get-pin-state');
  },
  notifyTimerDone(payload) {
    return ipcRenderer.invoke('tinyflow:notify-timer-done', payload);
  },
});
