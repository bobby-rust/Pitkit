import { dialog } from "electron";
import unzip from "./utils/unzip";
import path from "path";
import fs from "fs";

export default class ModInstaller {
	private async extractZip(
		source: string,
		dest: string,
		sendProgress: (progress: number) => void
	) {
		const result = await unzip(source, dest, sendProgress);
		console.log(result);
	}

	private async installModZip(
		source: string,
		dest: string,
		sendProgress: (progress: number) => void
	) {
		console.log("Installing mod zip (unimplemented)");
		return;
		await this.extractZip(source, dest, sendProgress);
	}

	private async installModFile(
		source: string,
		dest: string,
		sendProgress: (progress: number) => void
	) {
		const dirname = path.dirname(dest);
		if (!fs.existsSync(dirname)) {
			fs.mkdirSync(dirname, { recursive: true });
		}

		try {
			const result = fs.copyFile(source, dest, (err) => {
				if (err) {
					throw err;
				}
			});
			console.log("Result of moving file: ", result);
			console.log("Copied file from ", source, " to ", dest);
		} catch (err) {
			console.error("Unable to install mod: ", err);
		}
	}

	private async selectTrackType() {
		const result = await dialog.showMessageBox({
			type: "question",
			buttons: [
				"Supercross",
				"Motocross",
				"Supermoto",
				"Enduro",
				"Straight Rhythm",
				"Cancel",
			],
			title: "Select Track Type",
			message: "What type of track are you installing?",
			cancelId: 5, // If the user presses ESC or closes, it selects "Cancel"
		});

		if (result.response === 5) {
			console.log("User canceled track selection.");
			return null;
		}

		const trackTypes = [
			"supercross",
			"motocross",
			"supermoto",
			"enduro",
			"straight rhythm",
		];
		const selectedTrackType = trackTypes[result.response];

		console.log("User selected track type:", selectedTrackType);
		return selectedTrackType;
	}

	private async determineInstallDest(
		modsFolder: string,
		modPath: string
	): Promise<string> {
		console.log("determinine install destination for mod path: ", modPath);
		const ext = path.extname(modPath).toLowerCase();
		console.log(ext);
		if (ext === ".pkz") {
			// Todo: Figure out what type of track it is
			const trackType = await this.selectTrackType();
			console.log("Track type: ", trackType);
			return path.join(
				modsFolder,
				"tracks",
				"motocross",
				path.basename(modPath)
			);
		}

		return "";
	}

	/**
	 * Installs a mod
	 * @param modsFolder The folder where the user's mods are located
	 * @param sendProgress A function to update the frontend with install progress
	 * @returns {boolean} True if install was successful
	 */
	public async installMod(
		modsFolder: string,
		sendProgress: (progress: number) => void
	): Promise<boolean> {
		const source = await this.selectMod();
		if (!source) {
			console.error("Cancelled mod install");
			return null;
		}

		const dest = await this.determineInstallDest(modsFolder, source);
		console.log("Installing to : ", dest);

		if (path.extname(source).toLowerCase() === ".zip") {
			this.installModZip(source, dest, sendProgress);
		} else {
			this.installModFile(source, dest, sendProgress);
		}
		return true;
	}

	private async selectMod() {
		console.log("Selecting mod");
		const result = await dialog.showOpenDialog({
			properties: ["openFile"],
			filters: [{ name: "Mod Files", extensions: ["zip", "pkz"] }],
			title: "Select mod to install",
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		return result.filePaths[0];
	}
}
