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

