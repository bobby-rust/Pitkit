import { app, BrowserWindow, IpcMainInvokeEvent, autoUpdater, dialog, session, WebContentsView } from "electron";
import path from "path";
import started from "electron-squirrel-startup";
import { updateElectronApp } from "update-electron-app";
import log from "electron-log/main";

const modalManager = new ModalManager();
const modManager = new ModManager(modalManager);

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

import { ElectronBlocker } from "@ghostery/adblocker-electron";
const createWindow = async () => {
	const blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch);
	blocker.enableBlockingInSession(session.defaultSession);
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

	mxbModsView = new WebContentsView();

	mainWindow.on("resize", () => {
		if (!mainWindow || !mxbModsView) {
			return;
		}
		const bounds = mainWindow.getBounds();

		const titlebarHeight = 32;
		const sidebarWidth = 32;

		mxbModsView.setBounds({
			x: sidebarWidth * 3,
			y: titlebarHeight,
			width: bounds.width - sidebarWidth * 3,
			height: bounds.height - titlebarHeight,
		});
	});

	mxbModsView.webContents.setWindowOpenHandler(({ url }) => {
		console.log("Window open handler called");
		mxbModsView.webContents.loadURL(url);
		return { action: "deny" };
	});

	mxbModsView.webContents.session.on("will-download", (evt, item, wc) => {
		console.log("Dl evt: ", evt);
		console.log("dl item: ", item);

		// As soon as a download starts, remove the view and navigate home
		mainWindow.contentView.removeChildView(mxbModsView);
		mainWindow.webContents.send("navigate-to", "/");

		// 1) Track progress
		item.on("updated", (event, state) => {
			if (state === "interrupted") {
				console.log("Download interrupted");
				// Immediately tell renderer it failed, if you want:
				mainWindow.webContents.send("download-progress", {
					url: item.getURL(),
					percent: 0,
				});
				mainWindow.webContents.send("install-failed", "Download was interrupted.");
			} else if (state === "progressing") {
				if (item.isPaused()) {
					console.log("Download is paused");
				} else {
					const received = item.getReceivedBytes();
					const total = item.getTotalBytes();
					if (total > 0) {
						const percent = Math.round((received / total) * 100);
						mainWindow.webContents.send("download-progress", {
							url: item.getURL(),
							percent,
						});
						console.log(`Download progress: ${percent}%`);
					}
				}
			}
		});

		// 2) When the download finishes (either completed, cancelled, or interrupted)
		item.on("done", async (evt, state) => {
			if (state === "completed") {
				try {
					// Still remove the view if not already removed
					mainWindow.contentView.removeChildView(mxbModsView);

					// Now actually install the mod from the saved file path:
					// Wrap this in try/catch so if installMod throws, we catch and inform the renderer
					await modManager.installMod([item.getSavePath()]);

					// console.log("sending complete message to renderer");
					// mainWindow.webContents.send("install-complete", "Mod successfully installed");

					// You can also navigate back to “/” if needed
					mainWindow.webContents.send("navigate-to", "/");
					return;
				} catch (installError: any) {
					console.error("Error during installMod:", installError);
					// Send the raw error message (or a custom string) to renderer:
					mainWindow.webContents.send("install-failed", installError?.message || "Unknown install error");
				}
			} else if (state === "cancelled") {
				console.log("Download cancelled");
				mainWindow.webContents.send("install-failed", "Download was cancelled by the user.");
			} else if (state === "interrupted") {
				console.log("Download interrupted (done event)");
				mainWindow.webContents.send("install-failed", "Download was interrupted before completion.");
			} else {
				// catch all:
				console.log(`Download ended with state: ${state}`);
				mainWindow.webContents.send("install-failed", `Download ended unexpectedly: ${state}`);
			}
		});
	});

	// and load the index.html of the app.
	if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
		mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
	} else {
		mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
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
	await createWindow();

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
import ModManager from "./classes/ModManager";
import fetch from "cross-fetch";
import { IPC_CHANNELS } from "../shared/ipcChannels";
import { ModalManager } from "./classes/ModalManager";

ipcMain.handle("install-mod", async (event: IpcMainInvokeEvent, filePaths?: string[]) => {
	if (!modManager) return;
	try {
		await modManager.installMod(filePaths || null);
		// event.sender.send("install-complete", "Mod successfully installed");
	} catch (err) {
		event.sender.send("install-failed", "Error installing mod: " + err);
	}
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
	const session = await modManager.sb.getSession();
	if (!session) return;
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
	if (!session) return;

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

let mxbModsView: WebContentsView;
ipcMain.handle("open-mxb-mods-view", (_) => {
	console.log("Opening mxb mods");
	mainWindow.contentView.addChildView(mxbModsView);
	const bounds = mainWindow.getBounds();

	const titlebarHeight = 32;
	const sidebarWidth = 32;

	mxbModsView.setBounds({
		x: sidebarWidth * 3,
		y: titlebarHeight,
		width: bounds.width - sidebarWidth * 3,
		height: bounds.height - titlebarHeight,
	});
	mxbModsView.webContents.loadURL("https://mxb-mods.com");
});

ipcMain.handle("close-mxb-mods-view", (_) => {
	console.log("Closing mxb mods view");
	mainWindow.contentView.removeChildView(mxbModsView);
});

ipcMain.handle(IPC_CHANNELS.SHOW_MODAL, async (event, options) => {
	// `event.sender` is the WebContents of the renderer that sent the request.
	// We can get the BrowserWindow instance from the WebContents.
	const senderWindow = BrowserWindow.fromWebContents(event.sender);

	if (!senderWindow) {
		console.error("Could not find the sender window for the modal request.");
		return null;
	}

	// Use a switch to call the correct ModalManager method based on the type
	// sent from the renderer.
	switch (options.type) {
		case "notify":
			return await modalManager.notify(
				senderWindow,
				options.title,
				options.message,
				options.okLabel,
				options.cancelLabel
			);
		case "confirm":
			return await modalManager.confirm(
				senderWindow,
				options.title,
				options.message,
				options.okLabel,
				options.cancelLabel
			);
		case "textInput":
			return await modalManager.promptText(
				senderWindow,
				options.title,
				options.message,
				options.defaultValue,
				options.placeholder,
				options.okLabel,
				options.cancelLabel
			);
		case "select":
			return await modalManager.selectOption(
				senderWindow,
				options.title,
				options.message,
				options.options,
				options.okLabel,
				options.cancelLabel
			);
		default:
			console.error(`Unknown modal type received: ${options.type}`);
			return null;
	}
});

export { mainWindow };
