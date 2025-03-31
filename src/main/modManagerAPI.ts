import ini from "ini";
import fs from "fs";
import yauzl from "yauzl";
import mkdirp from "mkdirp";
import path from "path";
import os from "os";
import unzip from "./utils/unzip";
import { dialog, app, BrowserWindow } from "electron";
import { mainWindow } from "./main";

export default class ModManagerAPI {
	private config: { [key: string]: any };

	constructor() {}

	public async loadConfig() {
		if (!fs.existsSync("config.ini")) {
			fs.writeFileSync(
				"config.ini",
				"mods_folder=\nbase_game_directory="
			);
		}
		const cfgFile = fs.readFileSync("config.ini", "utf-8");

		this.config = ini.parse(cfgFile);

		// No base game directory set, get base game directory from user
		if (!this.config.base_game_directory) {
			this.config.base_game_directory = await this.getBaseGameDirectory();
			const modsPath = this.getModsPathFromBaseGameConfig();
			this.config.mods_folder = modsPath;
			fs.writeFileSync("config.ini", ini.encode(this.config));
		}

		console.log("Loaded config: ", this.config);
	}

	public async installMod(sendProgress: (progress: number) => void) {
		const modPath = await this.selectMod();
		if (!modPath) {
			console.error("Cancelled mod install");
			return;
		}
		await this.extractZip(modPath, this.config.mods_folder, sendProgress);
		console.log("Installing mod");
	}

	private async selectMod() {
		console.log("Selecting mod");
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [
				{ name: "Mod Files", extensions: ["zip"] },
				{ name: "Pkz Files", extensions: ["pkz"] },
			],
			title: "Select mod to install",
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		return result.filePaths[0];
	}

	private async showGetBaseGameDirectoryPrompt(): Promise<number> {
		const messageResult = await dialog.showMessageBox(mainWindow, {
			type: "info",
			title: "Select base game folder",
			message:
				"You must select the base game folder for MX Bikes to use the mod manager",
			buttons: ["Select folder", "Cancel"],

			defaultId: 0,
			cancelId: 1,
		});

		return messageResult.response;
	}

	/**
	 * Will prompt the user for the base game directory repeatedly until
	 * they select a valid base game file path. This function will never
	 * return if the user does not select a folder containing mxbikes.exe
	 * AND mxbikes.ini
	 *
	 * @returns {string} The base game directory for MX Bikes
	 */
	private async getBaseGameDirectory() {
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

		const mxbConfigPath = path.join(baseGameDir, "mxbikes.ini");
		const mxbPath = path.join(baseGameDir, "mxbikes.exe");

		const mxbExists = fs.existsSync(mxbPath);
		const mxbConfigExists = fs.existsSync(mxbConfigPath);
		if (!mxbExists || !mxbConfigExists) {
			console.error("Invalid  base game directory");
			const result = await dialog.showMessageBox({
				type: "error",
				title: "Invalid base game directory",
				message: "Would you like to try again?",
				buttons: ["Yes", "No"],
			});

			switch (result.response) {
				case 0:
					await this.getBaseGameDirectory();
					break;
				case 1:
				case 2:
					console.log("User clicked cancel");
					app.quit();
					break;
				default:
					console.log("Unknown button selected: ", result.response);
					app.quit();
					break;
			}
		}

		dialog.showMessageBox(mainWindow, {
			type: "none",
			message: "Success! Found base game directory",
			buttons: ["OK"],
		});

		return path.normalize(result.filePaths[0]);
	}

	private getModsPathFromBaseGameConfig() {
		const baseGameConfigPath = path.join(
			this.config["base_game_directory"],
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

	private async extractZip(
		source: string,
		destination: string,
		sendProgress: (progress: number) => void
	) {
		const result = await unzip(source, destination, sendProgress);
		console.log(result);
	}

	private installModFolder() {}

	private installModFile() {}
}
