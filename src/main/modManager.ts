import ini from "ini";
import fs from "fs";
import path from "path";
import os from "os";
import { dialog, app } from "electron";
import { mainWindow } from "./main";
import { Mod, ModsData } from "src/types/types";
import { loadMods } from "./utils/loadMods";
import ModInstaller from "./modInstaller";

interface Config {
	modsFolder: string;
	baseGameFolder: string;
}

export default class ModManager {
	private config: Config = {
		modsFolder: "",
		baseGameFolder: "",
	};
	private mods: ModsData;
	private installer: ModInstaller;

	constructor() {
		this.installer = new ModInstaller();
	}

	public async loadConfig() {
		if (!fs.existsSync("config.ini")) {
			fs.writeFileSync("config.ini", "mods_folder=\nbase_game_folder=");
		}
		const cfgFile = fs.readFileSync("config.ini", "utf-8");

		const cfgContents = ini.parse(cfgFile);

		// No base game directory set, get base game directory from user
		if (
			!cfgContents.base_game_folder ||
			!this.verifyBaseGameDirectory(cfgContents.base_game_folder)
		) {
			cfgContents.base_game_folder = await this.getBaseGameDirectory();
		}
		this.config.baseGameFolder = cfgContents.base_game_folder;
		const modsPath = this.getModsPathFromBaseGameConfig();
		cfgContents.mods_folder = modsPath;
		fs.writeFileSync("config.ini", ini.encode(cfgContents));

		this.config = {
			modsFolder: cfgContents.mods_folder,
			baseGameFolder: cfgContents.base_game_folder,
		};

		console.log("Loaded config: ", this.config);
	}

	public loadMods() {
		this.mods = loadMods();
	}

	public getMods() {
		return this.mods;
	}

	public async installMod(sendProgress: (progress: number) => void) {
		let mod;
		try {
			mod = await this.installer.installMod(
				this.config.modsFolder,
				sendProgress
			);
		} catch (err) {
			console.error(err);
		}

		if (!mod) {
			console.error("Unable to install mod");
			return;
		}

		this.addModToModsData(mod);
		this.writeModsToDisk();
	}

	private addModToModsData(mod: Mod) {
		this.mods.set(mod.name, mod);
	}

	private writeModsToDisk() {
		fs.writeFileSync(
			path.join("data", "mods.json"),
			JSON.stringify(Object.fromEntries(this.mods))
		);
	}

	private async showGetBaseGameDirectoryPrompt(): Promise<number> {
		const messageResult = await dialog.showMessageBox(mainWindow, {
			type: "info",
			title: "Select base game folder",
			message:
				"You must select the base game folder for MX Bikes to use the mod manager",
			buttons: ["OK", "Cancel"],

			defaultId: 0,
			cancelId: 1,
		});

		return messageResult.response;
	}

	private verifyBaseGameDirectory(baseGameDir: string) {
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
	private async getBaseGameDirectory(): Promise<string> {
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

			const choice = await this.showGetBaseGameDirectoryPrompt();
			switch (choice) {
				case 1:
					app.quit();
			}
			const result = await dialog.showOpenDialog({
				properties: ["openDirectory"],
				title: "Select base game folder",
			});

			if (result.canceled || result.filePaths.length === 0) {
				console.error("No folder selected");
				app.quit();
			}

			const baseGameDir = result.filePaths[0];

			const validBaseGameDir = this.verifyBaseGameDirectory(baseGameDir);

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

	private getModsPathFromBaseGameConfig() {
		const baseGameConfigPath = path.join(
			this.config.baseGameFolder,
			"mxbikes.ini"
		);

		if (!fs.existsSync(baseGameConfigPath)) {
			return null;
		}

		const baseGameConfigContents = fs.readFileSync(
			baseGameConfigPath,
			"utf-8"
		);

		const baseGameConfig = ini.parse(baseGameConfigContents);
		if (!baseGameConfig.mods.folder) {
			return path.join(
				os.homedir(),
				path.normalize("Documents/PiBoSo/MX Bikes/mods")
			);
		}
		return baseGameConfig.mods.folder;
	}
}
