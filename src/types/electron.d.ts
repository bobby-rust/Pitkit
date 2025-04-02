import { Mod } from "./types";

export interface IpcRendererEvent {
	preventDefault: () => void;
	sender: unknown;
	ports: unknown[];
	frameId: number;
	returnValue: any;
	reply: (...args: any[]) => void;
}

export interface ModManagerAPI {
	/**
	 * Installs a mod
	 * @returns A promise that resolves with the result of the installation
	 */
	installMod: () => Promise<any>;

	/**
	 * Registers a callback to receive progress updates during extraction
	 * @param callback Function that will be called with the progress percentage
	 * @returns The IPC event handler subscription
	 */
	onProgress: (callback: (progress: number) => void) => IpcRendererEvent;

	/**
	 * Requests the current mods data from the main process
	 * @returns A promise that resolves with the mods data
	 */
	requestModsData: () => Promise<ModsData>;
}
interface ElectronAPI {
	minimizeWindow: () => void;
	maximizeWindow: () => void;
	unmaximizeWindow: () => void;
	closeWindow: () => void;
	getInitialWindowState: () => Promise<boolean>;
	onWindowStateChange: (
		callback: (isMaximized: boolean) => void
	) => () => void; // Returns cleanup function
	removeAllListeners: () => void; // Optional alternative cleanup
}
declare global {
	interface Window {
		electron: Electron;
		modManagerAPI: ModManagerAPI;
		electronAPI: ElectronAPI;
	}
}

export {};
