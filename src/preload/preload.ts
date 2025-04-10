// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer, webUtils } from "electron";
import { ModsData } from "src/types/types";

contextBridge.exposeInMainWorld("modManagerAPI", {
	installMod: (filePaths?: string[]) =>
		ipcRenderer.invoke("install-mod", filePaths),
	uninstallMod: (modName: string) => {
		ipcRenderer.invoke("uninstall-mod", modName);
	},

	requestModsData: (): Promise<ModsData> =>
		ipcRenderer.invoke("request-mods-data"),

	requestExtractionProgress: (): Promise<number> =>
		ipcRenderer.invoke("request-extraction-progress"),
});

contextBridge.exposeInMainWorld("electronAPI", {
	// Functions callable from Renderer -> Main
	minimizeWindow: () => ipcRenderer.send("minimize-window"),
	maximizeWindow: () => ipcRenderer.send("maximize-window"),
	unmaximizeWindow: () => ipcRenderer.send("unmaximize-window"), // Use if you need separate restore
	closeWindow: () => ipcRenderer.send("close-window"),
	getInitialWindowState: () => ipcRenderer.invoke("get-initial-window-state"),

	// Function to setup listener for Main -> Renderer events
	onWindowStateChange: (callback: (arg0: any) => any) => {
		const subscription = (_event: any, isMaximized: any) =>
			callback(isMaximized);
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
	removeAllListeners: () =>
		ipcRenderer.removeAllListeners("window-state-changed"),
});
console.log("Preload script loaded.");
