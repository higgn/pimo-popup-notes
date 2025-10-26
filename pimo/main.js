const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
const dataFile = path.join(app.getPath('userData'), 'pimo-data.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 330,
    height: 210,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // optional
  });

  mainWindow.loadFile('index.html');

  // Load saved data
  if (fs.existsSync(dataFile)) {
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('load-data', data);
    });
  }
}

// list user data files for home view
ipcMain.on('list-user-files', (event) => {
  try {
    const folder = app.getPath('userData');
    const files = fs.readdirSync(folder).map(name => {
      const p = path.join(folder, name);
      const stat = fs.statSync(p);
      return { name, path: p, mtime: stat.mtime.toLocaleString() };
    }).sort((a,b)=> b.mtime.localeCompare(a.mtime));
    event.reply('home-data', files);
  } catch (err) {
    console.error('Failed to list user files', err);
    event.reply('home-data', []);
  }
});

ipcMain.on('reveal-file', (event, filePath) => {
  try {
    shell.showItemInFolder(filePath);
    event.reply('reveal-result', { success: true });
  } catch (err) {
    console.error('Failed to reveal file', err);
    event.reply('reveal-result', { success: false, error: err.message });
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// IPC handlers
ipcMain.handle('save-data', async (event, data) => {
  try {
    fs.writeFileSync(dataFile, JSON.stringify(data));
    return { success: true };
  } catch (err) {
    console.error('Failed to save data:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.on('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.on('slide-window', (event, direction) => {
  const [x, y] = mainWindow.getPosition();
  const [width, height] = mainWindow.getSize();
  const screen = require('electron').screen.getPrimaryDisplay().workAreaSize;

  if (direction === 'left') {
    mainWindow.setPosition(-width + 50, y); // slide left, show 50px
  } else if (direction === 'right') {
    mainWindow.setPosition(screen.width - 50, y);
  }
  // To restore, perhaps another IPC
});

ipcMain.on('restore-window', () => {
  const screen = require('electron').screen.getPrimaryDisplay().workAreaSize;
  mainWindow.setPosition(screen.width / 2 - Math.floor(315/2), screen.height / 2 - Math.floor(210/2));
});

ipcMain.on('maximize-window', () => {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  mainWindow.setSize(width, height);
  mainWindow.center();
});

ipcMain.on('unmaximize-window', () => {
  mainWindow.setSize(315, 210);
  mainWindow.center();
});

ipcMain.on('restore-small', () => {
  mainWindow.setSize(315, 210);
  mainWindow.center();
});

ipcMain.on('open-user-data', () => {
  // open the folder containing the saved data file
  const folder = app.getPath('userData');
  // shell.openPath returns a promise in newer Electron; just call it
  shell.openPath(folder).catch(err => {
    console.error('Failed to open user data folder', err);
  });
});

ipcMain.on('quit-window', () => {
  app.quit();
});