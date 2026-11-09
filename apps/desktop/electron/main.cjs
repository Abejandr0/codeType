const { app, BrowserWindow } = require('electron');
const path = require('node:path');
function createWindow() {
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 1050, minHeight: 700, titleBarStyle: 'hiddenInset', backgroundColor: '#14151c', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  if (process.env.VITE_DEV_SERVER_URL) window.loadURL(process.env.VITE_DEV_SERVER_URL); else window.loadFile(path.join(__dirname, '../dist/index.html'));
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
