import { app, BrowserWindow, IpcMainInvokeEvent } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
	app.quit();
}

let mainWindow: BrowserWindow;

const createWindow = () => {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		frame: false,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			navigateOnDragDrop: false,
		},
		autoHideMenuBar: true,
	});

	// and load the index.html of the app.
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(
			path.join(
				__dirname,
				`../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
			)
		);
	}
	// --- IPC Handlers for Window Controls ---
	ipcMain.on("minimize-window", (event) => {
		const webContents = event.sender;
		const win = BrowserWindow.fromWebContents(webContents);
		win?.minimize();
	});

	ipcMain.on("maximize-window", (event) => {
		const webContents = event.sender;
		const win = BrowserWindow.fromWebContents(webContents);
		if (win?.isMaximized()) {
			win.unmaximize();
		} else {
			win?.maximize();
		}
	});

	// Note: The old code had separate max/restore. We combine maximize/unmaximize logic here.
	// If you need separate 'restore' specifically tied to the restore button,
	// you might send 'unmaximize-window' instead.
	ipcMain.on("unmaximize-window", (event) => {
		const webContents = event.sender;
		const win = BrowserWindow.fromWebContents(webContents);
		win?.unmaximize();
	});

	ipcMain.on("close-window", (event) => {
		const webContents = event.sender;
		const win = BrowserWindow.fromWebContents(webContents);
		win?.close();
	});

	// --- Send Window State Changes to Renderer ---
	mainWindow.on("maximize", () => {
		mainWindow.webContents.send("window-state-changed", true); // Send 'true' for maximized
	});

	mainWindow.on("unmaximize", () => {
		mainWindow.webContents.send("window-state-changed", false); // Send 'false' for unmaximized
	});

	// --- Handle request for initial state ---
	ipcMain.handle("get-initial-window-state", (event) => {
		const webContents = event.sender;
		const win = BrowserWindow.fromWebContents(webContents);
		return win?.isMaximized() ?? false;
	});
	// Open the DevTools.
	mainWindow.webContents.openDevTools();
};

async function init() {
	modManager = new ModManager();
	await modManager.loadConfig();
	modManager.loadMods();
	console.log("Mods: ", modManager.getMods());
	mainWindow.webContents.on("did-finish-load", () => {
		mainWindow.webContents.send("mods-data", modManager.getMods());
		mainWindow.webContents.executeJavaScript(`
			// Disable default drag-and-drop behavior
			document.body.addEventListener('dragover', (e) => e.preventDefault());
			document.body.addEventListener('drop', (e) => e.preventDefault());
		`);
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
	createWindow();
	await init();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
	if (process.platform !== "darwin") {
		app.quit();
	}
});

app.on("activate", () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
import ModManager from "./modManager";
import { ipcMain } from "electron";

let modManager: ModManager;

ipcMain.handle("install-mod", async (event, filePaths?: string[]) => {
	try {
		const progressCallback = (progress: number) => {
			if (
				mainWindow.webContents &&
				!mainWindow.webContents.isDestroyed()
			) {
				mainWindow.webContents.send("extraction-progress", progress); // ✅ Target main window
			}
		};

		const result = await modManager.installMod(
			filePaths || [],
			progressCallback
		);

		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("mod-installation-complete", result);
		}

		return result;
	} catch (error) {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send(
				"mod-installation-error",
				error.message
			);
		}
		throw error;
	}
});

ipcMain.handle(
	"uninstall-mod",
	async (event: IpcMainInvokeEvent, modName: string) => {
		modManager.uninstallMod(modName);
	}
);

ipcMain.handle("request-mods-data", (event: IpcMainInvokeEvent) => {
	return modManager.getMods();
});

// Listen for dropped files
ipcMain.on("file-dropped", (event, filePaths) => {
	console.log("Received dropped file path:", filePaths);
	// Example: trigger mod install
	// modInstaller.install(filePaths[0]);
});

ipcMain.handle("handle-dropped-files", async (event, filePaths) => {
	try {
		// Now the main process manages the entire flow
		const result = await modManager.installMod(filePaths, (progress) => {
			// Send progress to ALL windows, not just the sender
			mainWindow.webContents.send("extraction-progress", progress);
		});

		// When complete, notify renderer to refresh
		mainWindow.webContents.send("mod-installation-complete", result);
		return { success: true };
	} catch (error) {
		console.error("Error installing dropped files:", error);
		return { success: false, error: error.message };
	}
});

export { mainWindow };
