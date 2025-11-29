/// <reference types="vite/client" />

interface ElectronAPI {
	invokeCommand: (command: string, payload?: { debug?: boolean }) => Promise<void>;
	onCommandOutput: (callback: (line: string) => void) => () => void;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}

export {};
