// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer, webUtils, webFrameMain } from "electron";
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
	getFilePaths: (fileList: any): string[] => {
		console.log(
			"File List type:",
			Object.prototype.toString.call(fileList)
		);
		console.log("File List:", fileList);

		// Extract files by checking for numeric keys
		const filePaths = [];
		for (const key in fileList) {
			if (fileList.hasOwnProperty(key) && !isNaN(Number(key))) {
				const file = fileList[key];
				// Make sure we're getting the path, not the File object
				const path = webUtils.getPathForFile(file);
				console.log(`Found file at key ${key}, path: ${path}`);
				filePaths.push(path);
			}
		}

		console.log("File paths array:", filePaths);
		return filePaths;
	},
	// Function to remove all listeners (e.g., on unload)
	removeAllListeners: () =>
		ipcRenderer.removeAllListeners("window-state-changed"),
});
console.log("Preload script loaded."); // Log to confirm execution
