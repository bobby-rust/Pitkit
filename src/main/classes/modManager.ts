import ini from "ini";
import fs from "fs";
import path from "path";
import { dialog, app } from "electron";
import { mainWindow } from "../main";
import { Mod, ModsData } from "src/types";
import ModInstaller from "./ModInstaller";
import { promptSelectFile } from "../utils/dialogHelper";

import log from "electron-log/main";
import TrainerService from "./TrainerService";
import SupabaseService from "./Supabase";

interface Config {
	modsFolder: string;
	baseGameFolder: string;
}

export default class ModManager {
	#config: Config = {
		modsFolder: "",
		baseGameFolder: "",
	};

	#mods: ModsData;
	#installer: ModInstaller;
	trainerService: TrainerService;
	sb: SupabaseService;
	#extractionProgress: number;
	#dataFile: string;

	constructor() {
		this.#extractionProgress = 0;

		this.#dataFile =
			process.env.NODE_ENV === "development"
				? path.join(__dirname, "data", "mods.json")
				: path.join(app.getPath("userData"), "ModsData", "mods.json");

		// Bind the function to ensure correct context when calling from other classes
		this.sendProgressToRenderer = this.sendProgressToRenderer.bind(this);

		this.#installer = new ModInstaller(this.#config.modsFolder, this.#config.baseGameFolder, this.sendProgressToRenderer);
		this.sb = new SupabaseService();
		this.trainerService = new TrainerService(this.sb, this.#config.modsFolder);
	}

	public getExtractionProgress() {
		return this.#extractionProgress;
	}

	public getModsFolder() {
		return this.#config.modsFolder;
	}

	public async installFromUrl(url: string) {
		console.log("Installing from url : ", url);
	}

	public async loadConfig() {
		if (!fs.existsSync("config.ini")) {
			fs.writeFileSync("config.ini", "mods_folder=\nbase_game_folder=");
		}
		const cfgFile = fs.readFileSync("config.ini", "utf-8");

		const cfgContents = ini.parse(cfgFile);
		if (!cfgContents.base_game_folder) {
			cfgContents.base_game_folder = "C:\\Program Files (x86)\\Steam\\steamapps\\common\\MX Bikes";
		}

		// No base game directory set, get base game directory from user
		if (!cfgContents.base_game_folder || !this.#verifyBaseGameDirectory(cfgContents.base_game_folder)) {
			cfgContents.base_game_folder = await this.#getBaseGameDirectory();
		}
		this.#config.baseGameFolder = cfgContents.base_game_folder;
		const modsPath = this.#getModsPathFromBaseGameConfig();
		cfgContents.mods_folder = modsPath;
		fs.writeFileSync("config.ini", ini.encode(cfgContents));

		this.#config = {
			modsFolder: cfgContents.mods_folder,
			baseGameFolder: cfgContents.base_game_folder,
		};

		this.#installer.setModsFolder(this.#config.modsFolder);
		this.#installer.setGameFolder(this.#config.baseGameFolder);

		this.trainerService.setProfilesFolder(path.join(path.dirname(this.#config.modsFolder), "profiles"));
		console.log("Setting trainer service profile path: ", path.join(path.dirname(this.#config.modsFolder), "profiles"));

		log.info("Loaded config: ", this.#config);
	}

	public loadMods() {
		this.#mods = this.#getModsData();
		// Send mods to renderer as soon as we load them
		const modsObject = Object.fromEntries(this.getMods());
		mainWindow.webContents.send("send-mods-data", modsObject);
	}

	#getModsData(): ModsData {
		const dir = path.dirname(this.#dataFile);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir);
		}

		if (!fs.existsSync(this.#dataFile)) {
			fs.writeFileSync(this.#dataFile, "{}");
		}

		const modsDataFileContents = fs.readFileSync(this.#dataFile, "utf-8").trim();

		let modsDataObject;
		try {
			modsDataObject = JSON.parse(modsDataFileContents);
		} catch (err) {
			// If the file exists but does not contain valid json, TERMINATE
			fs.writeFileSync(this.#dataFile, "{}");
			modsDataObject = {};
		}

		const modsData: ModsData = new Map<string, Mod>();

		Object.entries(modsDataObject).forEach(([key, value]) => {
			modsData.set(key, value as Mod);
		});

		return modsData;
	}

	public sendProgressToRenderer(progress: number) {
		mainWindow.webContents.send("install-progress", progress);
	}

	public getMods() {
		return this.#mods;
	}

	public async installMod(filePaths: string[] | null) {
		let mod;
		if (!filePaths) {
			// Stage 1: File selection
			const source = await this.#selectMod();

			if (!source) {
				throw new Error("Cancelled mod install");
			}

			const mod = await this.#installer.install(source);
			if (!mod) {
				this.#setExtractionProgress(0);
				throw new Error("Mod installation failed");
			}
			this.#addModToModsData(mod);
		} else {
			for (const source of filePaths) {
				mod = await this.#installer.install(source);
				if (!mod) {
					log.error("Unable to install mod");
					this.#setExtractionProgress(0);
					return;
				}
				log.info("Installed mod: ", mod);
				this.#addModToModsData(mod);
			}
		}

		this.#setExtractionProgress(0);
		this.#writeModsToDisk();

		return mod;
	}

	#setExtractionProgress(progress: number) {
		this.#extractionProgress = progress;
	}

	public async uninstallMod(modName: string) {
		const modToRemove = this.#mods.get(modName);
		await this.#installer.uninstall(modToRemove);
		this.#mods.delete(modName);
		this.#writeModsToDisk();
	}

	#addModToModsData(mod: Mod) {
		this.#mods.set(mod.name, mod);
	}

	#writeModsToDisk() {
		const dataDir = path.dirname(this.#dataFile);
		if (!fs.existsSync(dataDir)) {
			fs.mkdirSync(dataDir, { recursive: true });
		}

		fs.writeFileSync(path.join(dataDir, "mods.json"), JSON.stringify(Object.fromEntries(this.#mods)));
	}

	async #showGetBaseGameDirectoryPrompt(): Promise<number> {
		const messageResult = await dialog.showMessageBox(mainWindow, {
			type: "info",
			title: "Select base game folder",
			message: "You must select the base game folder for MX Bikes to use the mod manager",
			buttons: ["OK", "Cancel"],

			defaultId: 0,
			cancelId: 1,
		});

		return messageResult.response;
	}

	#verifyBaseGameDirectory(baseGameDir: string) {
		const mxbConfigPath = path.join(baseGameDir, "mxbikes.ini");
		const mxbPath = path.join(baseGameDir, "mxbikes.exe");

		const mxbExists = fs.existsSync(mxbPath);
		const mxbConfigExists = fs.existsSync(mxbConfigPath);

		return mxbExists && mxbConfigExists;
	}

	/**
	 * Will prompt the user for the base game directory repeatedly until
	 * they select a valid base game file path. This function will never
	 * return if the user does not select a folder containing mxbikes.exe
	 * AND mxbikes.ini
	 *
	 * @returns {string} The base game directory for MX Bikes
	 */
	async #getBaseGameDirectory(): Promise<string> {
		// If they fail after 100 attempts, that's on them :)

		for (let i = 0; i < 100; ++i) {
			if (i !== 0) {
				const choice = await dialog.showMessageBox({
					type: "question",
					title: "Invalid base game folder",
					message: "Could not find MX Bikes. Try again?",
					buttons: ["Yes", "No"],
				});
				if (choice.response === 1) {
					app.quit();
				}
			}

			const choice = await this.#showGetBaseGameDirectoryPrompt();

			switch (choice) {
				case 1:
					log.info("Quitting due to cancelled base game dir selection!");
					app.quit();
			}
			const result = await dialog.showOpenDialog({
				properties: ["openDirectory"],
				title: "Select base game folder",
			});

			if (result.canceled || result.filePaths.length === 0) {
				log.error("No folder selected");
				app.quit();
			}

			const baseGameDir = result.filePaths[0];

			const validBaseGameDir = this.#verifyBaseGameDirectory(baseGameDir);

			if (validBaseGameDir) {
				dialog.showMessageBox(mainWindow, {
					type: "none",
					message: "Success! Found base game directory",
					buttons: ["OK"],
				});

				return path.normalize(result.filePaths[0]);
			}
		}

		// If they fail 100 times just close the damn program
		app.quit();
	}

	#getModsPathFromBaseGameConfig() {
		const baseGameConfigPath = path.join(this.#config.baseGameFolder, "mxbikes.ini");

		if (!fs.existsSync(baseGameConfigPath)) {
			return null;
		}

		const baseGameConfigContents = fs.readFileSync(baseGameConfigPath, "utf-8");

		const baseGameConfig = ini.parse(baseGameConfigContents);
		if (!baseGameConfig.mods.folder) {
			return path.join(app.getPath("documents"), "PiBoSo", "MX Bikes", "mods");
		}
		return baseGameConfig.mods.folder;
	}

	async #selectMod() {
		const modPath = await promptSelectFile("Select A Mod To Install", ["zip", "pkz", "pnt", "rar"]);
		return modPath;
	}

	getTrainers() {
		return this.trainerService.getTrainers();
	}

	async installGhost(ghost: any) {
		console.log("installing ghost in backend:", ghost);
		await this.trainerService.installTrainer(ghost);
	}
}
