/// <reference types="vite/client" />

interface ElectronAPI {
	invokeCommand: (command: string, payload?: { debug?: boolean }) => Promise<void>;
	onCommandOutput: (callback: (line: string) => void) => () => void;
	onColimaState: (callback: (running: boolean) => void) => () => void;
	getColimaState: () => Promise<boolean | null>;
	onColimaContexts: (callback: (contexts: unknown[]) => void) => () => void;
	getColimaContexts: () => Promise<unknown[]>;
}

declare global {
	interface Window {
		electronAPI?: ElectronAPI;
	}
}

export {};
