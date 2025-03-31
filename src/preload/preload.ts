// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("modManagerAPI", {
	installMod: () => ipcRenderer.invoke("install-mod"),
	onProgress: (callback: (progress: number) => void) =>
		ipcRenderer.on("extract-progress", (_, progress) => callback(progress)),
});
