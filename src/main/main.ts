import { app, BrowserWindow, IpcMainInvokeEvent, autoUpdater, dialog } from "electron";
import path from "path";
import started from "electron-squirrel-startup";
import { updateElectronApp } from "update-electron-app";
import log from "electron-log/main";

const modManager = new ModManager();
const IS_DEV = !app.isPackaged;

autoUpdater.on("update-not-available", () => {
	log.info("No updates available");
});

autoUpdater.on("update-available", () => {
	log.info("New version available");
});

autoUpdater.on("error", (err: Error) => {
	log.error("Error updating application: " + err);
});

autoUpdater.on("checking-for-update", () => {
	log.info("Checking for update at ", autoUpdater.getFeedURL(), "...");
});

autoUpdater.on("update-downloaded", () => {
	log.info("Update downloaded");
});

autoUpdater.on("before-quit-for-update", () => {
	log.info("Restarting application to apply update");
});

updateElectronApp({
	// 10 minutes is the default and is a bit excessive.
	updateInterval: "1 hour",

	// Custom changelog update notification
	onNotifyUser: async ({ releaseNotes, releaseName }) => {
		log.info("releaseNotes: ", releaseNotes);
		if (!releaseNotes.trim()) {
			const response = await fetch("https://api.github.com/repos/bobby-rust/Pitkit/releases/latest", {
				headers: {
					"Content-Type": "application/json",
					"User-Agent": "PitKit",
				},
			});
			const json = await response.json();
			if (json.body) {
				releaseNotes = json.body;
			}
		}
		log.info("releaseName: ", releaseName);
		dialog
			.showMessageBox({
				type: "info",
				buttons: ["Restart Now", "Restart Later"],
				title: `What's new in ${releaseName}`,
				message: releaseNotes,
				noLink: true,
			})
			.then(({ response }) => {
				if (response === 0) {
					autoUpdater.quitAndInstall();
				}
			});
	},
});

log.info("Initializing logger");
log.initialize();

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
			nodeIntegration: false,
			webviewTag: true,
		},
		autoHideMenuBar: true,
	});

	// and load the index.html of the app.
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
	}

	mainWindow.webContents.on("did-attach-webview", (_event, viewWebContents: Electron.WebContents) => {
		viewWebContents.session.on("will-download", async (downloadEvent, item) => {
			const url = item.getURL();
			log.info(`Intercepted download from ${url}`);

			try {
				// Hand it off to your ModManager
				await modManager.installFromUrl(url);
				// prevent the default saving behavior
				downloadEvent.preventDefault();
				log.info("Mod install kicked off, download canceled in webview.");
			} catch (err) {
				log.error("Error installing mod:", err);
				// you could choose to let the download proceed or show an error dialog
			}
		});
	});

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
	IS_DEV && mainWindow.webContents.openDevTools();
};

async function init() {
	await modManager.loadConfig();
	modManager.loadMods();
	mainWindow.webContents.on("did-finish-load", () => {
		mainWindow.webContents.send("mods-data", modManager.getMods());
	});
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", async () => {
	createWindow();

	await init();
	log.info(`Started PitKit version ${app.getVersion()}`);
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
import { ipcMain } from "electron";
import ModManager from "./classes/modManager";

ipcMain.handle("install-mod", async (_event: IpcMainInvokeEvent, filePaths?: string[]) => {
	if (!modManager) return;
	await modManager.installMod(filePaths || null);
});

ipcMain.handle("uninstall-mod", async (_event: IpcMainInvokeEvent, modName: string) => {
	if (!modManager) return;
	modManager.uninstallMod(modName);
});

ipcMain.handle("request-mods-data", (_event: IpcMainInvokeEvent) => {
	if (!modManager) return;
	return modManager.getMods();
});

ipcMain.handle("request-extraction-progress", (_event: IpcMainInvokeEvent) => {
	if (!modManager) return;
	return modManager.getExtractionProgress();
});

const assetsPath = IS_DEV ? "src/renderer/assets" : path.join(process.resourcesPath, "assets");

ipcMain.handle("get-assets-path", (_event: IpcMainInvokeEvent) => {
	return assetsPath;
});

ipcMain.handle("supabase-upload-trainer", async (_, args) => {
	// args should be { userId, map, lapTime, filePath, fileName }
	if (!modManager) return;
	return modManager.sb.uploadTrainer(args);
});

ipcMain.handle("supabase-get-trainers", async (_) => {
	if (!modManager) return;
	return modManager.sb.getTrainers();
});

ipcMain.handle("supabase-set-auth", async (_, session: { access_token: string; refresh_token: string }) => {
	if (!modManager) return;
	modManager.sb.setSession(session);
});

ipcMain.handle("upload-trainers", async (_) => {
	if (!modManager) return;
	console.log("Uploading trainers!");

	const trainers = await modManager.getTrainers();

	console.log("Got trainers: ", trainers);

	const session = await modManager.sb.getSession();

	for (const trainer of trainers) {
		const opts = {
			userId: session.user.id,
			map: trainer.map,
			laptime: trainer.laptime,
			bike: trainer.bike,
			bikeCategory: trainer.bikeCategory,
			filePath: trainer.filePath,
			fileName: trainer.fileName,
			fileHash: trainer.fileHash,
			recordedAt: trainer.recordedAt,
		};

		await modManager.sb.uploadTrainer(opts);
	}
});

ipcMain.handle("install-ghost", async (_, ghost) => {
	if (!modManager) return;
	await modManager.installGhost(ghost);
});

export { mainWindow };
