const { app, BrowserWindow, shell, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

Menu.setApplicationMenu(null);
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow;

const IGNORED_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', 'coverage', '__pycache__',
  '.venv', 'venv', 'target', 'vendor', '.idea', '.vscode', '.gradle', 'bin', 'obj', '.turbo', '.cache', 'release',
  'Pods', '.dart_tool', '.expo',
]);
const MAX_ENTRIES = 6000;
const MAX_READ_SIZE = 600 * 1024;
const MAX_TOTAL_READ = 80 * 1024 * 1024;
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|svgz|pdf|zip|gz|tar|7z|rar|exe|dll|so|dylib|bin|jar|class|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|wav|ogg|psd|ai|sqlite|db|pyc|lockb)$/i;

/** Directories the renderer is allowed to write into (clones + folders picked by the user) */
const allowedRoots = new Set();
const cloneRoot = path.join(os.tmpdir(), 'codecity-nexus-clones');

function isInsideAllowed(target) {
  const resolved = path.resolve(target);
  for (const root of allowedRoots) {
    const rel = path.relative(root, resolved);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return true;
  }
  return false;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: 'CodeCity Nexus 3D',
    backgroundColor: '#05070d',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : null);
  if (!app.isPackaged && devUrl) {
    mainWindow.loadURL(devUrl).catch(() => mainWindow.loadFile(path.join(__dirname, '../dist/index.html')));
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------
// IPC: git clone (no shell, arguments validated)
// ---------------------------------------------------------------
ipcMain.handle('nexus:clone', async (event, url, branch) => {
  if (typeof url !== 'string' || !/^(https?:\/\/|git@)[\w.@:/~+%-]+$/.test(url) || url.startsWith('-')) {
    throw new Error('URL de repositorio no válida.');
  }
  if (branch !== undefined && branch !== null && (typeof branch !== 'string' || !/^[\w./-]+$/.test(branch) || branch.startsWith('-'))) {
    throw new Error('Nombre de rama no válido.');
  }
  fs.mkdirSync(cloneRoot, { recursive: true });
  const slug = url.replace(/\.git$/, '').split(/[/:]/).filter(Boolean).slice(-2).join('_').replace(/[^\w.-]/g, '_');
  const dest = path.join(cloneRoot, `${slug}_${Date.now()}`);

  const args = ['clone', '--depth', '1', '--single-branch', '--no-tags'];
  if (branch) args.push('--branch', branch);
  args.push('--', url, dest);

  event.sender.send('nexus:progress', 'Ejecutando git clone --depth 1…');
  await new Promise((resolve, reject) => {
    const child = execFile('git', args, { timeout: 5 * 60 * 1000, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } }, (err, _out, stderr) => {
      if (err) {
        if (err.code === 'ENOENT') reject(new Error('Git no está instalado en este equipo.'));
        else reject(new Error((stderr || err.message).trim().split('\n').slice(-2).join(' ')));
      } else resolve();
    });
    child.stderr?.on('data', (d) => {
      const line = String(d).trim().split(/\r|\n/).pop();
      if (line) event.sender.send('nexus:progress', line);
    });
  });

  allowedRoots.add(dest);
  const git = (a) => new Promise((resolve) => execFile('git', ['-C', dest, ...a], { windowsHide: true }, (err, out) => resolve(err ? '' : String(out).trim())));
  const [realBranch, commit] = await Promise.all([git(['rev-parse', '--abbrev-ref', 'HEAD']), git(['rev-parse', 'HEAD'])]);
  return { dir: dest, branch: realBranch || branch || 'HEAD', commit };
});

ipcMain.handle('nexus:pickFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Selecciona la carpeta del proyecto',
    properties: ['openDirectory'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  allowedRoots.add(path.resolve(res.filePaths[0]));
  return res.filePaths[0];
});

ipcMain.handle('nexus:scan', async (_e, dir) => {
  const root = path.resolve(String(dir));
  const allowed = [...allowedRoots].some((r) => root === r || isInsideAllowed(root));
  if (!allowed) throw new Error('Carpeta no autorizada.');

  const entries = [];
  let truncated = false;
  let totalRead = 0;

  const walk = (current) => {
    if (entries.length >= MAX_ENTRIES) {
      truncated = true;
      return;
    }
    let items;
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const abs = path.join(current, item.name);
      if (item.isSymbolicLink()) continue;
      if (item.isDirectory()) {
        if (!IGNORED_DIRS.has(item.name)) walk(abs);
        continue;
      }
      if (!item.isFile()) continue;
      let size = 0;
      try {
        size = fs.statSync(abs).size;
      } catch {
        continue;
      }
      const rel = path.relative(root, abs).split(path.sep).join('/');
      const entry = { path: rel, absPath: abs, size };
      if (!BINARY_EXT.test(item.name) && size <= MAX_READ_SIZE && totalRead + size <= MAX_TOTAL_READ) {
        try {
          const text = fs.readFileSync(abs, 'utf-8');
          if (!text.includes('\u0000')) {
            entry.content = text;
            totalRead += size;
          }
        } catch {
          /* unreadable */
        }
      }
      entries.push(entry);
      if (entries.length >= MAX_ENTRIES) {
        truncated = true;
        return;
      }
    }
  };
  walk(root);
  return { entries, truncated };
});

ipcMain.handle('nexus:writeFile', async (_e, absPath, content) => {
  if (typeof absPath !== 'string' || typeof content !== 'string') throw new Error('Parámetros no válidos.');
  if (!isInsideAllowed(absPath)) throw new Error('Ruta fuera del proyecto abierto.');
  const backup = absPath + '.codecity.bak';
  if (fs.existsSync(absPath) && !fs.existsSync(backup)) fs.copyFileSync(absPath, backup);
  fs.writeFileSync(absPath, content, 'utf-8');
});

ipcMain.handle('nexus:openPath', async (_e, p) => {
  if (typeof p !== 'string') return;
  if (/^https?:\/\//.test(p)) return shell.openExternal(p);
  if (isInsideAllowed(p) || allowedRoots.has(path.resolve(p))) await shell.openPath(p);
});

