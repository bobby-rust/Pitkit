import { Mod } from "./types";

// export interface IpcRendererEvent {
// 	preventDefault: () => void;
// 	sender: unknown;
// 	ports: unknown[];
// 	frameId: number;
// 	returnValue: any;
// 	reply: (...args: any[]) => void;
// }

declare global {
	interface Window {
		electron: Electron;
		modManagerAPI: import("../preload").ModManagerAPI;
		electronAPI: import("../preload").ElectronAPI;
		modalAPI: import("../preload").ModalAPI;
	}
}

export {};
