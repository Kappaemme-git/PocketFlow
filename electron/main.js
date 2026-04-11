const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, ipcMain, Menu, Notification, Tray, nativeImage, screen } = require('electron');

let mainWindow = null;
let tray = null;
let isPinned = true;
let isQuitting = false;
let dockIcon = null;

function applyPinnedState(nextPinned) {
  isPinned = Boolean(nextPinned);
  if (!mainWindow) return isPinned;
  mainWindow.setAlwaysOnTop(isPinned, isPinned ? 'floating' : 'normal');
  mainWindow.setMovable(!isPinned);
  if (typeof mainWindow.setVisibleOnAllWorkspaces === 'function') {
    mainWindow.setVisibleOnAllWorkspaces(isPinned, { visibleOnFullScreen: isPinned });
  }
  return isPinned;
}

function createTrayIcon() {
  const image = nativeImage
    .createFromPath(path.join(__dirname, 'trayTemplate.svg'))
    .resize({ width: 18, height: 18 });

  image.setTemplateImage(true);
  return image;
}

function createDockIcon() {
  try {
    const svg = fs.readFileSync(path.join(__dirname, '..', 'assets', 'pocketflow-icon.svg'), 'utf8');
    return nativeImage
      .createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      .resize({ width: 256, height: 256 });
  } catch (_error) {
    return null;
  }
}

function applyDockBranding() {
  if (process.platform !== 'darwin') return;
  app.setName('PocketFlow');
  app.dock?.show();
  if (!dockIcon || dockIcon.isEmpty()) dockIcon = createDockIcon();
  if (dockIcon && !dockIcon.isEmpty()) {
    app.dock?.setIcon(dockIcon);
  }
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function hideWindow() {
  if (!mainWindow) return;
  mainWindow.hide();
}

function updateTrayMenu() {
  if (!tray) return;
  const visible = Boolean(mainWindow && mainWindow.isVisible());
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: visible ? 'Hide PocketFlow' : 'Show PocketFlow', click: () => visible ? hideWindow() : showWindow() },
    { type: 'separator' },
    { label: 'Quit PocketFlow', click: () => {
      isQuitting = true;
      app.quit();
    }},
  ]));
}

function createTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip('PocketFlow');
  if (process.platform === 'darwin') {
    tray.setTitle('◴');
  }
  tray.on('click', () => {
    if (!mainWindow) return;
    showWindow();
    updateTrayMenu();
  });
  updateTrayMenu();
}

function snapWindowToCorner(corner, force = false) {
  if (!mainWindow) return;
  if (!force && mainWindow.isAlwaysOnTop()) return;
  const area = screen.getPrimaryDisplay().workArea;
  const [width, height] = mainWindow.getSize();
  const margin = 10;
  let x = area.x + margin;
  let y = area.y + margin;

  if (corner === 'top-right') x = area.x + area.width - width - margin;
  if (corner === 'bottom-right') {
    x = area.x + area.width - width - margin;
    y = area.y + area.height - height - margin;
  }
  if (corner === 'bottom-left') y = area.y + area.height - height - margin;

  mainWindow.setPosition(Math.round(x), Math.round(y));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 400,
    minWidth: 400,
    minHeight: 400,
    maxWidth: 400,
    maxHeight: 400,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: isPinned,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  applyPinnedState(isPinned);
  applyDockBranding();
  snapWindowToCorner('top-left', true);
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    hideWindow();
    updateTrayMenu();
  });
  mainWindow.on('show', updateTrayMenu);
  mainWindow.on('hide', updateTrayMenu);
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    app.setActivationPolicy('regular');
    applyDockBranding();
  }

  ipcMain.handle('tinyflow:snap-corner', (_event, corner) => {
    snapWindowToCorner(corner, false);
  });
  ipcMain.handle('tinyflow:window-control', (_event, action) => {
    if (!mainWindow) return;
    if (action === 'close') hideWindow();
    if (action === 'minimize') mainWindow.minimize();
    if (action === 'zoom') mainWindow.setFullScreen(!mainWindow.isFullScreen());
    updateTrayMenu();
  });
  ipcMain.handle('tinyflow:toggle-pin', () => {
    if (!mainWindow) return isPinned;
    applyPinnedState(!isPinned);
    updateTrayMenu();
    return isPinned;
  });
  ipcMain.handle('tinyflow:get-pin-state', () => {
    return isPinned;
  });
  ipcMain.handle('tinyflow:notify-timer-done', (_event, payload = {}) => {
    const title = payload.title || 'PocketFlow';
    const body = payload.body || 'Timer finished.';

    if (!Notification.isSupported()) return false;

    const notification = new Notification({
      title,
      body,
      silent: false,
    });

    if (process.platform === 'darwin') {
      app.dock?.bounce('informational');
    }
    mainWindow?.flashFrame?.(true);
    notification.show();
    notification.on('show', () => {
      setTimeout(() => mainWindow?.flashFrame?.(false), 1800);
    });
    return true;
  });

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    applyDockBranding();
    showWindow();
    updateTrayMenu();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});
