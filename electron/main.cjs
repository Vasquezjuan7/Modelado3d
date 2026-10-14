const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');

// Disable standard legacy application menu for a sleek native desktop look
Menu.setApplicationMenu(null);

// Hardware acceleration & performance switches for 3D WebGL / Vulkan
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CodeCity Nexus 3D - Spatial Architecture Engine',
    backgroundColor: '#060811',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
  });

  // Handle external links in native default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const isDev = !app.isPackaged && process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      // Fallback to local files if dev server is not active
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    // In standalone desktop mode: load local bundled files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC handlers for desktop operations
ipcMain.handle('open-release-folder', () => {
  const releasePath = path.join(__dirname, '../release');
  shell.openPath(releasePath);
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
