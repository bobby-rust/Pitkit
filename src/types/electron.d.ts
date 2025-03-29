declare global {
	interface Window {
		electron: Electron;
		modManagerAPI: any;
	}
}

export {};
