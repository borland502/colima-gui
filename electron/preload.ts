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
});
