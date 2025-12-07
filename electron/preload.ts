import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

type CommandPayload = {
  debug?: boolean;
};

type Unsubscribe = () => void;

declare global {
  interface Window {
    electronAPI?: {
      invokeCommand: (command: string, payload?: CommandPayload) => Promise<void>;
      onCommandOutput: (callback: (line: string) => void) => Unsubscribe;
      onColimaState: (callback: (running: boolean) => void) => Unsubscribe;
      getColimaState: () => Promise<boolean | null>;
      onColimaContexts: (callback: (contexts: unknown[]) => void) => Unsubscribe;
      getColimaContexts: () => Promise<unknown[]>;
    };
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  invokeCommand: (command: string, payload: CommandPayload = {}) =>
    ipcRenderer.invoke('colima:invoke', command, payload),
  onCommandOutput: (callback: (line: string) => void): Unsubscribe => {
    const subscription = (_event: IpcRendererEvent, message: string) => callback(message);
    ipcRenderer.on('colima:output', subscription);
    return () => ipcRenderer.removeListener('colima:output', subscription);
  },
  onColimaState: (callback: (running: boolean) => void): Unsubscribe => {
    const subscription = (_event: IpcRendererEvent, running: boolean) => callback(running);
    ipcRenderer.on('colima:state', subscription);
    return () => ipcRenderer.removeListener('colima:state', subscription);
  },
  getColimaState: () => ipcRenderer.invoke('colima:get-state'),
  onColimaContexts: (callback: (contexts: unknown[]) => void): Unsubscribe => {
    const subscription = (_event: IpcRendererEvent, contexts: unknown[]) => callback(contexts);
    ipcRenderer.on('colima:contexts', subscription);
    return () => ipcRenderer.removeListener('colima:contexts', subscription);
  },
  getColimaContexts: () => ipcRenderer.invoke('colima:get-contexts'),
});
