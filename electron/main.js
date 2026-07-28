const path = require('path');
const { app, BrowserWindow, ipcMain, shell, Notification, desktopCapturer, session } = require('electron');
const { startServer, stopServer } = require('../server');

const PROTOCOL = 'relay';

/** @type {string | null} */
let appUrl = null;
/** @type {BrowserWindow | null} */
let mainWindow = null;
/** @type {Map<string, import('electron').Notification[]>} */
const notificationsByRoom = new Map();
/** @type {import('electron').Notification[]} */
const notificationsUnscoped = [];
/** @type {{ ok: boolean, registered: boolean, message: string, platform: string, detail?: string }} */
let protocolStatus = {
  ok: false,
  registered: false,
  message: 'Not checked yet',
  platform: process.platform,
};

/**
 * Dev (`electron .`) must register electron.exe + app path on Windows,
 * and status checks must use the same path/args.
 */
function getProtocolClientRegistration() {
  if (process.defaultApp || !app.isPackaged) {
    const appPath =
      process.argv.length >= 2
        ? path.resolve(process.argv[1])
        : path.resolve(path.join(__dirname, '..'));
    return {
      execPath: process.execPath,
      args: [appPath],
    };
  }
  return { execPath: null, args: null };
}

function refreshProtocolStatus(startup = false) {
  const { execPath, args } = getProtocolClientRegistration();
  let registered = false;
  try {
    registered =
      execPath && args
        ? Boolean(app.isDefaultProtocolClient(PROTOCOL, execPath, args))
        : Boolean(app.isDefaultProtocolClient(PROTOCOL));
  } catch (error) {
    protocolStatus = {
      ok: false,
      registered: false,
      message: `Could not check protocol handler: ${error?.message || error}`,
      platform: process.platform,
    };
    return protocolStatus;
  }
  protocolStatus = {
    ok: registered,
    registered,
    message: registered
      ? `${PROTOCOL} is registered${startup ? ' (startup=ok)' : ''} on ${process.platform}.`
      : `${PROTOCOL} is not registered as the default handler on ${process.platform}.`,
    platform: process.platform,
  };
  return protocolStatus;
}

function registerProtocolHandler() {
  const { execPath, args } = getProtocolClientRegistration();
  try {
    // Clear stale registry entries so Repair/startup can rewrite them.
    try {
      if (execPath && args) {
        app.removeAsDefaultProtocolClient(PROTOCOL, execPath, args);
        app.removeAsDefaultProtocolClient(PROTOCOL);
      } else {
        app.removeAsDefaultProtocolClient(PROTOCOL);
      }
    } catch {
      // ignore remove failures
    }

    const ok =
      execPath && args
        ? app.setAsDefaultProtocolClient(PROTOCOL, execPath, args)
        : app.setAsDefaultProtocolClient(PROTOCOL);

    const status = refreshProtocolStatus();
    if (!ok && !status.registered) {
      status.ok = false;
      status.message = `Windows did not accept ${PROTOCOL}:// registration. Try Repair again (don’t run Relay as Administrator).`;
    } else if (status.registered) {
      status.message = `${PROTOCOL} is registered on ${process.platform}.`;
    }
    protocolStatus = status;
    return status;
  } catch (error) {
    protocolStatus = {
      ok: false,
      registered: false,
      message: `Failed to register ${PROTOCOL}://: ${error?.message || error}`,
      platform: process.platform,
      detail: String(error?.stack || error),
    };
    return protocolStatus;
  }
}

function handleProtocolUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value.toLowerCase().startsWith(`${PROTOCOL}:`)) return;
  focusMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('relay:protocol-open', { url: value });
  }
}

function extractProtocolArg(argv = []) {
  return (argv || []).find((arg) => String(arg).toLowerCase().startsWith(`${PROTOCOL}:`)) || null;
}

function trackNotification(roomId, notification) {
  const close = () => {
    if (roomId) {
      const list = notificationsByRoom.get(roomId) || [];
      notificationsByRoom.set(
        roomId,
        list.filter((entry) => entry !== notification),
      );
    } else {
      const idx = notificationsUnscoped.indexOf(notification);
      if (idx >= 0) notificationsUnscoped.splice(idx, 1);
    }
  };
  notification.on('close', close);
  notification.on('click', close);
  if (roomId) {
    const list = notificationsByRoom.get(roomId) || [];
    list.push(notification);
    notificationsByRoom.set(roomId, list);
  } else {
    notificationsUnscoped.push(notification);
  }
}

function clearTrackedNotifications(roomId = null) {
  if (roomId) {
    const list = notificationsByRoom.get(roomId) || [];
    for (const notification of list) {
      try {
        notification.close();
      } catch {
        // ignore
      }
    }
    notificationsByRoom.delete(roomId);
  } else {
    for (const list of notificationsByRoom.values()) {
      for (const notification of list) {
        try {
          notification.close();
        } catch {
          // ignore
        }
      }
    }
    notificationsByRoom.clear();
    for (const notification of notificationsUnscoped) {
      try {
        notification.close();
      } catch {
        // ignore
      }
    }
    notificationsUnscoped.length = 0;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.flashFrame(false);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // macOS deep links must be subscribed before ready
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });
}

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.ico');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#313338',
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (!appUrl) {
    throw new Error('Relay backend URL is not ready.');
  }

  void mainWindow.loadURL(appUrl);

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const tag = ['log', 'warn', 'error'][level] || 'log';
    console.log(`[renderer:${tag}] ${message}${sourceId ? ` (${sourceId}:${line})` : ''}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    void mainWindow.webContents
      .executeJavaScript(
        `({
          loginHidden: !!(document.getElementById('loginView') && document.getElementById('loginView').hidden),
          chatHidden: !!(document.getElementById('chatView') && document.getElementById('chatView').hidden),
        })`,
      )
      .then((state) => console.log('[ui-state]', state))
      .catch((error) => console.warn('[ui-state] failed', error?.message || error));
  });

  mainWindow.on('focus', () => {
    if (mainWindow) mainWindow.flashFrame(false);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.flashFrame(false);
}

ipcMain.handle('relay:app-info', () => ({
  name: 'Relay',
  version: app.getVersion(),
  platform: process.platform,
  appPath: app.getAppPath(),
}));

ipcMain.handle('relay:open-source', async () => {
  const target = path.join(app.getAppPath(), 'README.md');
  const result = await shell.openPath(target);
  if (result) {
    await shell.openPath(app.getAppPath());
  }
  return { ok: true };
});

ipcMain.handle('relay:protocol-status', () => refreshProtocolStatus());

ipcMain.handle('relay:protocol-repair', () => registerProtocolHandler());

ipcMain.handle('relay:window-focused', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return Boolean(win && win.isFocused());
});

ipcMain.handle('relay:window-action', (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (action === 'minimize') win.minimize();
  else if (action === 'maximize') {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  } else if (action === 'close') win.close();
  return true;
});

ipcMain.handle('relay:show-notification', (event, payload = {}) => {
  if (!Notification.isSupported()) return { ok: false, reason: 'unsupported' };

  const title = String(payload.title || 'Relay').slice(0, 120);
  const body = String(payload.body || '').slice(0, 240);
  const roomId = payload.roomId ? String(payload.roomId) : null;

  const notification = new Notification({
    title,
    body,
    silent: Boolean(payload.silent),
  });

  notification.on('click', () => {
    focusMainWindow();
    if (roomId && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('relay:notification-click', { roomId });
    }
  });

  notification.show();
  trackNotification(roomId, notification);

  const win = BrowserWindow.fromWebContents(event.sender) || mainWindow;
  if (win && !win.isDestroyed() && !win.isFocused()) {
    win.flashFrame(true);
  }

  return { ok: true };
});

ipcMain.handle('relay:clear-notifications', (_event, payload = {}) => {
  const roomId = payload?.roomId ? String(payload.roomId) : null;
  clearTrackedNotifications(roomId);
  return { ok: true };
});

app.whenReady().then(async () => {
  const readyAt = Date.now();
  if (process.platform === 'win32') {
    app.setAppUserModelId('dev.relay.app');
  }

  const dataDir = path.join(app.getPath('userData'), 'data');
  const pluginsDir = path.join(app.getPath('userData'), 'plugins');

  const backend = await startServer({
    host: '127.0.0.1',
    // Stable port keeps renderer localStorage origin consistent across relaunches.
    // Falls back automatically if busy (see startServer).
    port: Number(process.env.RELAY_PORT) || 6080,
    dataDir,
    pluginsDir,
  });

  appUrl = `http://127.0.0.1:${backend.port}`;
  createWindow();
  console.log(`[relay] window opened (+${Date.now() - readyAt}ms after app ready)`);

  // Non-critical startup work after first paint path is unblocked.
  setImmediate(() => {
    try {
      registerProtocolHandler();
    } catch (error) {
      console.warn('[relay] protocol register deferred failed', error?.message || error);
    }
    try {
      session.defaultSession.setDisplayMediaRequestHandler(
        async (_request, callback) => {
          try {
            const sources = await desktopCapturer.getSources({
              types: ['screen', 'window'],
              thumbnailSize: { width: 0, height: 0 },
              fetchWindowIcons: false,
            });
            const preferred =
              sources.find((source) => String(source.id).startsWith('screen:')) || sources[0];
            if (!preferred) {
              callback({});
              return;
            }
            callback({ video: preferred });
          } catch (error) {
            console.warn('[relay] display media handler failed', error);
            callback({});
          }
        },
        { useSystemPicker: true },
      );
    } catch (error) {
      console.warn('[relay] setDisplayMediaRequestHandler unavailable', error);
    }

    try {
      const fs = require('fs');
      const bundledPlugins = path.join(__dirname, '..', 'plugins');
      if (fs.existsSync(bundledPlugins)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
        for (const name of fs.readdirSync(bundledPlugins)) {
          const src = path.join(bundledPlugins, name);
          const dest = path.join(pluginsDir, name);
          if (!fs.existsSync(dest) && fs.statSync(src).isDirectory()) {
            fs.cpSync(src, dest, { recursive: true });
          }
        }
      }
    } catch (error) {
      console.warn('[relay] plugin seed failed', error?.message || error);
    }
  });

  const startupProtocol = extractProtocolArg(process.argv);
  if (startupProtocol) {
    mainWindow?.webContents.once('did-finish-load', () => handleProtocolUrl(startupProtocol));
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('second-instance', (_event, argv) => {
  focusMainWindow();
  const protocolArg = extractProtocolArg(argv);
  if (protocolArg) handleProtocolUrl(protocolArg);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void stopServer();
});
