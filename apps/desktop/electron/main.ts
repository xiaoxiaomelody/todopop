import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
let mainWindow: BrowserWindow | null = null;
async function createMainWindow() {
  mainWindow = new BrowserWindow({ width: 900, height: 700, webPreferences: {
    preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
  } });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  if (process.env.ELECTRON_RENDERER_URL) await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  else await mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  mainWindow.on('closed', () => { mainWindow = null; });
}
app.whenReady().then(async () => {
  await createMainWindow();
  app.on('activate', () => { if (!mainWindow) void createMainWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
