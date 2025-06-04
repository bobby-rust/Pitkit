// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer, webUtils } from "electron";
import { ModsData } from "src/types";
import { IPC_CHANNELS } from "../shared/ipcChannels";

export interface ElectronAPI {
	minimizeWindow: () => void;
	maximizeWindow: () => void;
	unmaximizeWindow: () => void;
	closeWindow: () => void;
	getInitialWindowState: () => Promise<boolean>;
	getAssetsPath: () => Promise<string>;
	onWindowStateChange: (callback: (isMaximized: boolean) => void) => () => void; // Returns cleanup function
	getFilePath: (file: any) => string;
	// notifyDrop: (filePaths: string[]) => void;
	removeAllListeners: () => void; // Optional alternative cleanup
	openMXBModsView: () => void;
	closeMXBModsView: () => void;
	onNavigate: (callback: (route: string) => void) => void;
	removeNavigateListener: () => Electron.IpcRenderer;
}

export interface ModManagerAPI {
	/**
	 * Installs a mod
	 * @returns A promise that resolves with the result of the installation
	 */
	installMod: (filePaths?: string[]) => Promise<any>;
	uninstallMod: (modName: string) => void;
	/**
	 * Requests the current mods data from the main process
	 * @returns A promise that resolves with the mods data
	 */
	requestModsData: () => Promise<ModsData>;
	requestExtractionProgress: () => Promise<number>;
	onMessage: (channel: any, callback: any) => void;
	uploadTrainers: () => void;
	installGhost: (ghost: any) => any;
}

export interface ModalAPI {
	onOpenModal: (callback: (event: Electron.IpcRendererEvent, args: any) => void) => void;
	sendModalResponse: (response: any) => void;
	removeOpenModalListener: () => void;
}

export interface SupabaseAPI {
	uploadTrainer: (args: { userId: string; map: string; lapTime: number; filePath: string; fileName: string }) => void;
	getTrainers: () => any;
	setSupabaseAuth: (session: { access_token: string; refresh_token: string }) => void;
}

const electronAPI: ElectronAPI = {
	// Functions callable from Renderer -> Main
	minimizeWindow: () => ipcRenderer.send("minimize-window"),
	maximizeWindow: () => ipcRenderer.send("maximize-window"),
	unmaximizeWindow: () => ipcRenderer.send("unmaximize-window"), // Use if you need separate restore
	closeWindow: () => ipcRenderer.send("close-window"),
	getInitialWindowState: () => ipcRenderer.invoke("get-initial-window-state"),
	getAssetsPath: () => ipcRenderer.invoke("get-assets-path"),
	// Function to setup listener for Main -> Renderer events
	onWindowStateChange: (callback: (arg0: any) => any) => {
		const subscription = (_event: any, isMaximized: any) => callback(isMaximized);
		ipcRenderer.on("window-state-changed", subscription);

		// Return a cleanup function
		return () => {
			ipcRenderer.removeListener("window-state-changed", subscription);
		};
	},
	getFilePath: (file: any): string => {
		return webUtils.getPathForFile(file);
	},
	// Function to remove all listeners (e.g., on unload)
	removeAllListeners: () => ipcRenderer.removeAllListeners("window-state-changed"),
	openMXBModsView: () => ipcRenderer.invoke("open-mxb-mods-view"),
	closeMXBModsView: () => ipcRenderer.invoke("close-mxb-mods-view"),
	onNavigate: (callback) => ipcRenderer.on("navigate-to", (_event, route) => callback(route)),
	removeNavigateListener: () => ipcRenderer.removeAllListeners("navigate-to"),
};

const modManagerAPI: ModManagerAPI = {
	installMod: (filePaths?: string[]) => ipcRenderer.invoke("install-mod", filePaths),
	uninstallMod: (modName: string) => {
		ipcRenderer.invoke("uninstall-mod", modName);
	},
	requestModsData: (): Promise<ModsData> => ipcRenderer.invoke("request-mods-data"),
	requestExtractionProgress: (): Promise<number> => ipcRenderer.invoke("request-extraction-progress"),
	onMessage: (channel: any, callback: any) => {
		ipcRenderer.on(channel, (_event, data) => callback(data));
	},
	uploadTrainers: () => {
		ipcRenderer.invoke("upload-trainers");
	},
	installGhost: (ghost: any) => {
		ipcRenderer.invoke("install-ghost", ghost);
	},
};

const modalAPI: ModalAPI = {
	// Renderer listens for this
	onOpenModal: (callback) => {
		// Remove previous listener if exists to prevent duplicates
		ipcRenderer.removeAllListeners(IPC_CHANNELS.OPEN_MODAL);
		ipcRenderer.on(IPC_CHANNELS.OPEN_MODAL, callback);
	},
	// Renderer calls this
	sendModalResponse: (response) => {
		ipcRenderer.send(IPC_CHANNELS.MODAL_RESPONSE, response);
	},
	// Cleanup function
	removeOpenModalListener: () => {
		ipcRenderer.removeAllListeners(IPC_CHANNELS.OPEN_MODAL);
	},
};

const supabaseAPI = {
	/**
	 * args = {
	 *   userId: string,
	 *   map:    string,
	 *   lapTime:number,
	 *   filePath:string,  // full path on disk
	 *   fileName:string,  // filename.ext
	 * }
	 */
	uploadTrainer: (args: any) => ipcRenderer.invoke("supabase-upload-trainer", args),

	/**
	 * userId: string
	 */
	getTrainers: () => ipcRenderer.invoke("supabase-get-trainers"),
	setSupabaseAuth: (session: { access_token: string; refresh_token: string }) =>
		ipcRenderer.invoke("supabase-set-auth", session),
};

contextBridge.exposeInMainWorld("modalAPI", modalAPI);
contextBridge.exposeInMainWorld("modManagerAPI", modManagerAPI);
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
contextBridge.exposeInMainWorld("supabaseAPI", supabaseAPI);

console.log("Preload script loaded.");
