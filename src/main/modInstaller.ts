import { dialog } from "electron";
import unzip from "./utils/unzip";
import path from "path";
import fs from "fs";
import { parseZipFile, zipHasModsSubdir } from "./utils/zipParser";
import { FolderStructure, Mod, ModsData } from "src/types/types";

export default class ModInstaller {
	/**
	 * Installs a mod
	 * @param modsFolder The folder where the user's mods are located
	 * @param sendProgress A function to update the frontend with install progress
	 */
	public async installMod(
		modsFolder: string,
		setExtractionProgress: (progress: number) => void,
		source?: string
	): Promise<Mod | void> {
		if (!source) {
			source = await this.selectMod();
		}
		if (!source) {
			throw new Error("Cancelled mod install");
		}

		const dest = await this.determineInstallDest(modsFolder, source);
		console.log("Installing to : ", dest);

		if (dest === "") {
			return;
		}

		if (path.extname(source).toLowerCase() === ".zip") {
			await this.installModZip(source, dest, setExtractionProgress);
			const mod = await parseZipFile(source);
			return mod;
		} else if (path.extname(source).toLowerCase() === ".pkz") {
			await this.installModFile(source, dest);
			const mod: Mod = {
				name: path.basename(source).split(".pkz")[0],
				type: "track",
				files: {
					files: [] as any,
					subfolders: {
						tracks: {
							files: [] as any,
							subfolders: {
								[path.basename(path.dirname(dest))]: {
									files: [path.basename(source)],
									subfolders: {},
								},
							},
						},
					},
				},
				installDate: new Date().toLocaleDateString(),
			};

			return mod;
		}
	}

	public async uninstallMod(
		modsFolder: string,
		mods: ModsData,
		modName: string
	) {
		const modToRemove = mods.get(modName);
		this.deleteFolderStructure(modToRemove.files, modsFolder);
	}

	private deleteFolderStructure(
		folderStructure: FolderStructure,
		currentDirectory: string
	) {
		for (const file of folderStructure.files) {
			try {
				fs.rmSync(path.join(currentDirectory, file));
			} catch (err) {
				console.error(err);
			}
		}
		try {
			if (this.isDirEmpty(currentDirectory)) {
				fs.rmdirSync(currentDirectory);
			}
		} catch (err) {
			console.error(err);
		}

		for (const [k, v] of Object.entries(folderStructure.subfolders)) {
			currentDirectory = path.join(currentDirectory, k);
			console.log("Current directory: ", currentDirectory);
			console.log("K: ", k);
			console.log("V: ", v);
			this.deleteFolderStructure(v, currentDirectory);
			currentDirectory = path.dirname(currentDirectory);
		}
	}

	private isDirEmpty(dirname: string) {
		let files;
		try {
			files = fs.readdirSync(dirname);
		} catch (err) {
			console.error(err);
			return false;
		}
		console.log("Files in ", dirname, ": ", files);
		if (!files.length) {
			return true;
		}
		return false;
	}

	private async installModZip(
		source: string,
		dest: string,
		setExtractionProgress: (progress: number) => void
	) {
		console.log("installing mod zip");
		await unzip(source, dest, setExtractionProgress);
	}

	private async installModFile(source: string, dest: string) {
		const dirname = path.dirname(dest);
		if (!fs.existsSync(dirname)) {
			fs.mkdirSync(dirname, { recursive: true });
		}

		try {
			await fs.promises.copyFile(source, dest);
			console.log("Copied file from ", source, " to ", dest);
		} catch (err) {
			console.error("Unable to install mod: ", err);
		}
	}

	private async selectTrackType(trackName: string) {
		const trackTypes = ["supercross", "motocross", "supermoto", "enduro"];
		const result = await dialog.showMessageBox({
			type: "question",
			buttons: [
				"Supercross",
				"Motocross",
				"Supermoto",
				"Enduro",
				"Cancel",
			],
			title: "Select Track Type",
			message: `What type of track is ${trackName}?`,
			cancelId: 4, // If the user presses ESC or closes, it selects "Cancel"
		});

		console.log("Response: ", result.response, trackTypes[result.response]);

		if (result.response === 4) {
			console.log("User canceled track selection.");
			return null;
		}

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
			const trackName = path.basename(modPath);
			console.log("Got pkz");
			const trackType = await this.selectTrackType(trackName);
			console.log("Track type: ", trackType);
			return path.join(modsFolder, "tracks", trackType, trackName);
		} else if (ext === ".zip") {
			console.log("Got zip file...");
			const hasModsSubdir = await zipHasModsSubdir(modPath);
			if (hasModsSubdir) {
				// path.dirname will return the parent directory of the argument
				return path.dirname(modsFolder);
			}
		} else {
			console.log(ext);
			return "";
		}

		return "";
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
