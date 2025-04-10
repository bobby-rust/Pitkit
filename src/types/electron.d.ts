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
	installMod: (filePaths?: string[]) => Promise<any>;

	uninstallMod: (modName: string) => Promise<any>;

	/**
	 * Requests the current mods data from the main process
	 * @returns A promise that resolves with the mods data
	 */
	requestModsData: () => Promise<ModsData>;

	requestExtractionProgress: () => Promise<number>;
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
	getFilePath: (file: any) => string;
	getFilePaths: (files: any) => string[];
	notifyDrop: (filePaths: string[]) => void;
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
