const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const appDirectory = path.resolve(__dirname, '..');

function isTrustedSandboxHelper(candidate) {
  try {
    const helper = fs.realpathSync(candidate);
    const helperStat = fs.statSync(helper);
    if (!helperStat.isFile() || helperStat.uid !== 0 || (helperStat.mode & 0o4000) === 0 || (helperStat.mode & 0o111) === 0) return false;

    let directory = path.dirname(helper);
    while (directory !== path.dirname(directory)) {
      const directoryStat = fs.statSync(directory);
      if (directoryStat.uid !== 0 || (directoryStat.mode & 0o022) !== 0) return false;
      directory = path.dirname(directory);
    }
    return true;
  } catch {
    return false;
  }
}

function findSandboxHelper() {
  const candidates = [
    process.env.CHROME_DEVEL_SANDBOX,
    '/usr/lib/chromium/chrome-sandbox',
    '/usr/lib/chromium-browser/chrome-sandbox',
    '/usr/lib/claude-desktop/chrome-sandbox',
    '/opt/google/chrome/chrome-sandbox',
    '/opt/brave.com/brave/chrome-sandbox',
  ].filter(Boolean);

  return candidates.find(isTrustedSandboxHelper);
}

if (process.platform === 'linux') {
  const sandboxHelper = findSandboxHelper();
  if (!sandboxHelper) {
    console.error(
      'No se encontró un helper SUID de Chromium seguro. Instala Chromium/Chrome/Brave o define ' +
        'CHROME_DEVEL_SANDBOX con la ruta a un chrome-sandbox propiedad de root y con permisos 4755. ' +
        'No cambies permisos dentro de node_modules.',
    );
    process.exit(1);
  }
  process.env.CHROME_DEVEL_SANDBOX = sandboxHelper;
}

process.env.ANGULAR_DEV_SERVER_URL ||= 'http://localhost:5173';

const electronBinary = require('electron');
const electron = spawn(electronBinary, ['.'], {
  cwd: appDirectory,
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => electron.kill(signal));
}

electron.on('error', (error) => {
  console.error('No se pudo iniciar Electron:', error.message);
  process.exitCode = 1;
});

electron.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
