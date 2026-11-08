// TODOPOP desktop: one transparent, always-on-top window that covers the screen.
// Bubbles float over every other app (including full-screen Chrome). The window only
// takes the mouse while the cursor is over a bubble or the control panel; everywhere
// else, clicks pass straight through to whatever is underneath.

const { app, BrowserWindow, screen, ipcMain, Tray, Menu, globalShortcut, nativeImage, shell, powerMonitor, net } = require('electron');
const path = require('path');
const { openInNewWindow } = require('./openwin');
// Windows updates itself from the GitHub releases (it downloads in the background and installs when TODOPOP restarts).
// A Mac can't install unsigned updates, so there the page shows a "new version" note with a download link instead.
let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch { /* running from source without it */ }

const isMac = process.platform === 'darwin';
const SHORTCUT = 'CommandOrControl+Shift+Space';
let win = null;
let tray = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

// Windows: stay above the taskbar, so the taskbar, its icons and the tray menu stay reachable.
// Mac: cover the whole screen, so the focus-mode border always runs along the real edges of the display,
// whether the Dock is showing (desktop) or swiped away (an app in full screen). This is a floating panel at the
// highest level, so macOS lets it cover the menu bar and Dock area; clicks pass through everywhere but our controls.
// Panels, pop-ups and the focus bar still keep clear of the menu bar and Dock: the page is told where they are (insets()).
const overlayBounds = () => { const d = screen.getPrimaryDisplay(); return isMac ? d.bounds : d.workArea; };
let trayMenu = null;
let selfFocus = 0; // when we bring the window forward ourselves
let interactive = false; // true while the cursor is over a bubble or the panel

// which strips of the window the system uses (Mac: menu bar and Dock; Windows: none, the window already avoids the taskbar),
// so the page keeps its controls clear of them on any screen
function insets() {
  const d = screen.getPrimaryDisplay(), w = d.workArea, b = win ? win.getContentBounds() : overlayBounds(); // where the window really is
  return { t: Math.max(0, w.y - b.y), l: Math.max(0, w.x - b.x), r: Math.max(0, (b.x + b.width) - (w.x + w.width)), b: Math.max(0, (b.y + b.height) - (w.y + w.height)) };
}
function fitToDisplay() {
  if (!win) return;
  win.setBounds(overlayBounds());
  win.webContents.send('insets', insets());
}

function createOverlay() {
  win = new BrowserWindow({
    ...overlayBounds(),
    title: 'TODOPOP',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: !isMac, // Windows: clicking the taskbar icon "minimizes"; we turn that into show/hide panel
    maximizable: false,
    fullscreenable: false,
    enableLargerThanScreen: isMac, // never let macOS nudge the window down from under the menu bar
    skipTaskbar: isMac, // Windows: a TODOPOP icon sits in the taskbar like any other app
    alwaysOnTop: true,
    show: false,
    // On macOS a "panel" window can sit above other apps' full-screen spaces.
    ...(isMac ? { type: 'panel' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false, // keep bubbles growing while another app has focus
    },
  });

  // Highest normal level: above full-screen apps and browser windows.
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Start click-through; the page turns mouse capture on over bubbles and the panel.
  win.setIgnoreMouseEvents(true, { forward: true });

  // task links open in a new window of your normal browser
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https?|mailto|file):/i.test(url)) openInNewWindow(url, screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea); return { action: 'deny' }; });
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  // if the system moves or resizes the window (a new screen, the Dock appearing), tell the page so its panels stay clear
  const sendInsets = () => { if (win && !win.isDestroyed()) win.webContents.send('insets', insets()); };
  win.on('move', sendInsets); win.on('resize', sendInsets); win.webContents.on('did-finish-load', sendInsets);
  if (!isMac) {
    // Clicking the taskbar icon never hides the bubbles: it brings up the control panel instead.
    win.on('minimize', () => { win.restore(); selfFocus = Date.now(); win.focus(); win.webContents.send('show-panel'); });
    // The overlay only takes the mouse over bubbles and the panel, so being brought to the front any other way
    // (the taskbar icon, Alt+Tab) means you came looking for TODOPOP: open the panel.
    win.on('focus', () => { if (!interactive && Date.now() - selfFocus > 400) win.webContents.send('show-panel'); });
  }
  win.once('ready-to-show', () => {
    win.show();
    win.focus(); // so the centred control panel can be typed into right away
  });
}

function showPanel() {
  if (!win) return;
  selfFocus = Date.now();
  win.show();
  win.focus();
  win.webContents.send('show-panel');
}

function togglePanel() {
  if (!win) return;
  selfFocus = Date.now();
  win.show();
  win.focus();
  win.webContents.send('toggle-panel');
}

function trayIcon() {
  const file = isMac ? 'trayTemplate.png' : 'tray.png';
  const img = nativeImage.createFromPath(path.join(__dirname, 'assets', file));
  if (isMac) img.setTemplateImage(true);
  return img;
}

let paused = false;
let lang = 'en'; // the page tells us which language it's in; the tray menu follows
const tr = (en, zh) => lang === 'zh' ? zh : en;
const sendPause = (mode) => win && win.webContents.send('pause', mode);

function buildTrayMenu() {
  const shortcutLabel = isMac ? '⌘⇧Space' : 'Ctrl+Shift+Space';
  trayMenu = Menu.buildFromTemplate([
      { label: tr(`Show / hide control panel (${shortcutLabel})`, `显示 / 隐藏控制面板（${shortcutLabel}）`), click: togglePanel },
      { type: 'separator' },
      paused
        ? { label: tr('Resume growing', '恢复生长'), click: () => sendPause('resume') }
        : {
            label: tr('Pause growing', '暂停生长'),
            submenu: [
              { label: tr('For 30 minutes', '30 分钟'), click: () => sendPause('30') },
              { label: tr('For 1 hour', '1 小时'), click: () => sendPause('60') },
              { label: tr('Until tomorrow morning', '到明天早上'), click: () => sendPause('tomorrow') },
              { label: tr('Until I resume', '直到我恢复'), click: () => sendPause('off') },
            ],
          },
      { type: 'separator' },
      {
        label: tr('Start at login', '开机时启动'),
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { label: tr('Quit TODOPOP', '退出 TODOPOP'), role: 'quit' },
  ]);
  if (isMac) tray.setContextMenu(trayMenu); // Windows opens it on right-click below
  tray.setToolTip(paused ? tr('TODOPOP (paused)', 'TODOPOP（已暂停）') : 'TODOPOP');
}

function createTray() {
  tray = new Tray(trayIcon());
  buildTrayMenu();
  if (!isMac) {
    tray.on('click', togglePanel);
    tray.on('right-click', () => tray.popUpContextMenu(trayMenu)); // open the menu ourselves, so it always shows on Windows
  }
}

ipcMain.on('lang', (_event, l) => { lang = l === 'zh' ? 'zh' : 'en'; if (tray) buildTrayMenu(); });
ipcMain.on('paused', (_event, on) => {
  paused = !!on;
  if (tray) buildTrayMenu();
});

ipcMain.handle('app-version', () => app.getVersion());
ipcMain.handle('insets', () => insets());
// the calendar's private link (an .ics file): fetched here, because calendar sites don't let web pages read them directly.
// Only the user's own link is ever fetched, straight from their calendar; nothing passes through TODOPOP.
ipcMain.handle('cal-fetch', async (_event, link) => {
  try {
    const u = new URL(String(link).trim().replace(/^webcal:/i, 'https:'));
    if (u.protocol !== 'https:') return { error: 'https' };
    const res = await net.fetch(u.href, { headers: { Accept: 'text/calendar, */*' } });
    if (!res.ok) return { error: 'status', status: res.status };
    const text = await res.text();
    if (text.length > 8e6) return { error: 'big' };
    if (!/BEGIN:VCALENDAR/.test(text.slice(0, 2000))) return { error: 'notcal' };
    return { text };
  } catch (e) { return { error: 'net' }; }
});
ipcMain.on('install-update', () => { if (autoUpdater) setImmediate(() => autoUpdater.quitAndInstall(true, true)); });
function setupUpdates() {
  if (isMac || !autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // even if you never click Restart, the next start is the new version
  autoUpdater.on('update-downloaded', (info) => { if (win) win.webContents.send('update', { version: info.version, ready: true }); });
  autoUpdater.on('error', () => {}); // offline, or GitHub unreachable: try again later
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 15000); // a moment after start
  setInterval(check, 6 * 60 * 60 * 1000); // and every 6 hours
}

ipcMain.on('set-interactive', (_event, on) => {
  if (!win) return;
  interactive = !!on;
  win.setIgnoreMouseEvents(!on, { forward: true });
});

app.on('second-instance', showPanel);

if (!isMac) app.setAppUserModelId('app.todopop.desktop'); // the taskbar shows TODOPOP's name and icon

app.whenReady().then(() => {
  // the focus timer only counts time you could actually be working: it pauses while the computer sleeps, locks or shuts down
  const power = (state) => { if (win && !win.isDestroyed()) win.webContents.send('power', state); };
  powerMonitor.on('suspend', () => power('sleep'));
  powerMonitor.on('lock-screen', () => power('sleep'));
  powerMonitor.on('shutdown', () => power('sleep'));
  powerMonitor.on('resume', () => power('wake'));
  powerMonitor.on('unlock-screen', () => power('wake'));
  // nobody at the keyboard for two minutes (or the screen went dark): the bubbles redraw once a second instead of 60 times
  let idle = false;
  setInterval(() => {
    let st = 'active'; try { st = powerMonitor.getSystemIdleState(120); } catch (e) {}
    const now = st !== 'active';
    if (now !== idle) { idle = now; power(now ? 'idle' : 'active'); }
  }, 10000);
  if (isMac && app.dock) app.dock.hide(); // a floating layer, not a regular windowed app
  createOverlay();
  createTray();
  setupUpdates();
  globalShortcut.register(SHORTCUT, togglePanel);
  screen.on('display-metrics-changed', fitToDisplay);
  screen.on('display-added', fitToDisplay);
  screen.on('display-removed', fitToDisplay);
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
// TODOPOP: touched 2026-11-08
