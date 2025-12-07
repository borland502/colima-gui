import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import readline from 'node:readline';
import { spawn, execSync } from 'node:child_process';
import { app, BrowserWindow, ipcMain, shell, WebContents, nativeImage, Menu, MenuItemConstructorOptions } from 'electron';

const COLIMA_CONFIG_PATH = path.join(os.homedir(), '.colima/default/colima.yaml');
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const COLIMA_STATE_EVENT = 'colima:state';
const COLIMA_STATE_REQUEST = 'colima:get-state';
const COLIMA_CONTEXTS_EVENT = 'colima:contexts';
const COLIMA_CONTEXTS_REQUEST = 'colima:get-contexts';

const COMMAND_MAP: Record<string, string> = {
  start_colima: 'colima start',
  stop_colima: 'colima stop',
  restart_colima: 'colima restart',
  status_colima: 'colima status',
  delete_colima: 'colima delete',
  list_colima: 'colima list',
  prune_colima: 'colima prune',
  version_colima: 'colima version',
};

let mainWindow: BrowserWindow | undefined;
let colimaWatcher: NodeJS.Timeout | undefined;
let contextsWatcher: NodeJS.Timeout | undefined;
let lastKnownColimaState: boolean | null = null;

const getAugmentedPath = (): string => {
  const defaultPaths = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'];
  try {
    const shellPath = process.env.SHELL || '/bin/zsh';
    const loginPath = execSync(`${shellPath} -l -c 'echo -n $PATH'`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const combined = `${loginPath}:${defaultPaths.join(':')}`;
    return Array.from(new Set(combined.split(':').filter(Boolean))).join(':');
  } catch (error) {
    console.warn('Failed to read login shell PATH, falling back to process.env.PATH', error);
  }

  const fallback = `${process.env.PATH || ''}:${defaultPaths.join(':')}`;
  return Array.from(new Set(fallback.split(':').filter(Boolean))).join(':');
};

const ICON_FILENAME = '512x512.png';
const resolveIconPath = () => {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'icons', ICON_FILENAME);
  }
  return path.join(__dirname, '..', 'resources', 'icons', ICON_FILENAME);
};

const createWindow = () => {
  const iconPath = resolveIconPath();
  const iconImage = nativeImage.createFromPath(iconPath);
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: iconImage.isEmpty() ? undefined : iconImage,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (DEV_SERVER_URL) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
};

const emitOutput = (sender: WebContents, line: string) => {
  if (sender.isDestroyed()) {
    return;
  }
  const match = /msg="([^"]*)"/.exec(line);
  const payload = match?.[1] ?? line;
  sender.send('colima:output', payload);
};

const emitColimaState = (running: boolean) => {
  lastKnownColimaState = running;
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(COLIMA_STATE_EVENT, running);
    }
  });
};

const emitColimaContexts = (contexts: unknown[]) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(COLIMA_CONTEXTS_EVENT, contexts);
    }
  });
};

const createCommandEnv = (debug?: boolean): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: getAugmentedPath() };
  if (debug) {
    env.COLIMA_DEBUG = '1';
  } else {
    delete env.COLIMA_DEBUG;
  }
  return env;
};

const isColimaRunning = async (): Promise<boolean> => {
  try {
    const exitCode = await runCommand('colima status');
    return exitCode === 0;
  } catch {
    return false;
  }
};

const runCommand = (command: string) =>
  new Promise<number>((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      env: createCommandEnv(),
      stdio: 'ignore',
    });
    child.once('error', (error) => reject(error));
    child.once('close', (code) => resolve(code ?? 0));
  });

const streamCommandOutput = (command: string, debug: boolean | undefined, sender: WebContents) =>
  new Promise<number>((resolve, reject) => {
    const env = createCommandEnv(debug);

    const child = spawn('sh', ['-c', command], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const handleStream = (stream?: NodeJS.ReadableStream | null) => {
      if (!stream) {
        return;
      }
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      rl.on('line', (line) => emitOutput(sender, line));
      rl.on('close', () => rl.removeAllListeners());
    };

    handleStream(child.stdout);
    handleStream(child.stderr);

    child.once('error', (error) => reject(error));
    child.once('close', (code) => resolve(code ?? 0));
  });

const registerHandlers = () => {
  ipcMain.handle('colima:invoke', async (event, command: string, options: { debug?: boolean } = {}) => {
    if (command === 'open_config') {
      if (!fs.existsSync(COLIMA_CONFIG_PATH)) {
        throw new Error('Configuration file not found');
      }
      event.sender.send('colima:output', 'Opening configuration file...');
      await shell.openPath(COLIMA_CONFIG_PATH);
      return;
    }

    const shellCommand = COMMAND_MAP[command];
    if (!shellCommand) {
      throw new Error(`Unknown command: ${command}`);
    }

    const exitCode = await streamCommandOutput(shellCommand, options.debug, event.sender);
    if (exitCode !== 0) {
      event.sender.send(
        'colima:output',
        `Command "${shellCommand}" exited with code ${exitCode}. Is Colima running?`,
      );
    }
    isColimaRunning().then(emitColimaState).catch((error) => console.warn('Failed to refresh state', error));
  });

  ipcMain.handle(COLIMA_STATE_REQUEST, async () => {
    if (lastKnownColimaState === null) {
      const running = await isColimaRunning();
      emitColimaState(running);
    }
    return lastKnownColimaState;
  });

  ipcMain.handle(COLIMA_CONTEXTS_REQUEST, async () => {
    const contexts = await fetchColimaContexts();
    emitColimaContexts(contexts);
    return contexts;
  });
};

const parseColimaListJson = (raw: string) => {
  try {
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const jsonLines = lines.filter((line) => line.startsWith('{') && line.endsWith('}'));
    return jsonLines.map((line) => JSON.parse(line));
  } catch (error) {
    console.warn('Failed to parse colima list JSON output', error);
    return [];
  }
};

const fetchColimaContexts = async () => {
  try {
    const output = execSync('colima list --json', {
      env: createCommandEnv(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return parseColimaListJson(output);
  } catch (error) {
    console.warn('Failed to fetch Colima contexts', error);
    return [];
  }
};

const startColimaWatcher = () => {
  const poll = () => {
    isColimaRunning()
      .then(emitColimaState)
      .catch((error) => console.warn('Failed to poll Colima state', error));
  };
  poll();
  colimaWatcher = setInterval(poll, 5000);
};

const startContextsWatcher = () => {
  const poll = () => {
    fetchColimaContexts().then(emitColimaContexts).catch((error) => console.warn('Failed to poll contexts', error));
  };
  poll();
  contextsWatcher = setInterval(poll, 3000);
};

const APP_NAME = 'Colima GUI';
app.setName(APP_NAME);
app.name = APP_NAME;
app.setAboutPanelOptions({
  applicationName: APP_NAME,
});

const toMenuItems = (items: readonly MenuItemConstructorOptions[]): MenuItemConstructorOptions[] =>
  items.map((item) => ({ ...item }));

const buildMenu = () => {
  const isMac = process.platform === 'darwin';
  const macAppSubmenu: readonly MenuItemConstructorOptions[] = [
    { role: 'about' },
    { type: 'separator' },
    { role: 'services' },
    { type: 'separator' },
    { role: 'hide' },
    { role: 'hideOthers' },
    { role: 'unhide' },
    { type: 'separator' },
    { role: 'quit' },
  ];
  const fileSubmenu: readonly MenuItemConstructorOptions[] = isMac
    ? [{ role: 'close' }]
    : [{ role: 'quit' }];
  const viewSubmenu: readonly MenuItemConstructorOptions[] = [
    { role: 'reload' },
    { role: 'forceReload' },
    { role: 'toggleDevTools' },
    { type: 'separator' },
    { role: 'resetZoom' },
    { role: 'zoomIn' },
    { role: 'zoomOut' },
    { type: 'separator' },
    { role: 'togglefullscreen' },
  ];
  const windowSubmenu: readonly MenuItemConstructorOptions[] = isMac
    ? [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' },
      ]
    : [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ];
  const helpSubmenu: readonly MenuItemConstructorOptions[] = [
    {
      label: 'Learn More',
      click: async () => {
        await shell.openExternal('https://github.com/borland502/colima-gui');
      },
    },
  ];
  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: APP_NAME, submenu: toMenuItems(macAppSubmenu) }] : []),
    { label: 'File', submenu: toMenuItems(fileSubmenu) },
    { label: 'View', submenu: toMenuItems(viewSubmenu) },
    { role: 'window', submenu: toMenuItems(windowSubmenu) },
    { role: 'help', submenu: toMenuItems(helpSubmenu) },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const icon = nativeImage.createFromPath(resolveIconPath());
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
  }
  buildMenu();
  createWindow();
  registerHandlers();
  startColimaWatcher();
  startContextsWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (colimaWatcher) {
    clearInterval(colimaWatcher);
  }
  if (contextsWatcher) {
    clearInterval(contextsWatcher);
  }
  app.quit();
});
