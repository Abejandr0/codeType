const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const appDirectory = path.resolve(__dirname, '..');

const electronArgs = ['.'];
if (process.platform === 'linux') {
  // Electron's Chromium looks for the SUID helper beside Electron itself, so
  // CHROME_DEVEL_SANDBOX does not fix an unpacked npm installation. Prefer
  // Chromium's namespace sandbox when the current user can create namespaces.
  const namespaceCheck = spawnSync('unshare', ['--user', '--map-root-user', 'true'], {
    stdio: 'ignore',
  });

  if (namespaceCheck.error || namespaceCheck.status !== 0) {
    console.error(
      'Linux no permite crear namespaces de usuario y Electron no tiene su helper SUID configurado. ' +
        'Habilita user namespaces para tu usuario o instala/configura chrome-sandbox de Electron ' +
        'como root (modo 4755). No uses --no-sandbox ni cambies permisos en node_modules.',
    );
    process.exit(1);
  }

  electronArgs.push('--disable-setuid-sandbox');
}

process.env.ANGULAR_DEV_SERVER_URL ||= 'http://localhost:5173';

const electronBinary = require('electron');
const electron = spawn(electronBinary, electronArgs, {
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
