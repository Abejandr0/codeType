const { app, BrowserWindow, ipcMain, Notification } = require('electron');
const path = require('node:path');
ipcMain.handle('notifications:practice-completed', (event, result) => {
  const source = event.senderFrame?.url ?? '';
  if (!(source.startsWith('file://') || source.startsWith('http://localhost:5173/'))) return false;
  if (!Notification.isSupported() || typeof result?.lessonTitle !== 'string' || typeof result?.accuracy !== 'number' || typeof result?.wpm !== 'number') return false;
  new Notification({title:'CodeType · práctica guardada',body:`${result.lessonTitle} · ${result.accuracy}% de precisión · ${result.wpm} WPM`}).show();
  return true;
});
function createWindow() {
  const window = new BrowserWindow({ width: 1440, height: 920, minWidth: 1050, minHeight: 700, titleBarStyle: 'hiddenInset', backgroundColor: '#14151c', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  const page = process.env.ANGULAR_DEV_SERVER_URL
    ? window.loadURL(process.env.ANGULAR_DEV_SERVER_URL)
    : window.loadFile(path.join(__dirname, '../dist/browser/index.html'));
  void page.catch((error) => console.error('CodeType could not load its interface', error));
}
app.whenReady().then(() => { createWindow(); app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); }).catch((error) => console.error('CodeType failed to start', error));
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
