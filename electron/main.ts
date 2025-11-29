import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import readline from 'node:readline';
import { spawn, execSync } from 'node:child_process';
import { app, BrowserWindow, ipcMain, shell, WebContents } from 'electron';

const COLIMA_CONFIG_PATH = path.join(os.homedir(), '.colima/default/colima.yaml');
const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

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

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

const streamCommandOutput = (command: string, debug: boolean | undefined, sender: WebContents) =>
  new Promise<number>((resolve, reject) => {
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: getAugmentedPath() };
    if (debug) {
      env.COLIMA_DEBUG = '1';
    } else {
      delete env.COLIMA_DEBUG;
    }

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
  });
};

app.whenReady().then(() => {
  createWindow();
  registerHandlers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
