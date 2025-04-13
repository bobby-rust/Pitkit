import { dialog } from "electron";
import unzip from "./utils/unzip";
import path from "path";
import fs from "fs";
import { parseZipFile, zipHasModsSubdir } from "./utils/zipParser";
import {
	FolderStructure,
	Mod,
	ModsData,
	ModType,
	TrackType,
} from "src/types/types";
import { promptQuestion, promptSelectFile } from "./utils/dialogHelper";

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

		const modName = path.basename(source).split(".pkz")[0];
		const modType = await this.selectModType(modName);

		const dest = await this.getInstallDest(modsFolder, source);
		console.log("Installing to : ", dest);

		if (dest === "") {
			return;
		}

		if (path.extname(source).toLowerCase() === ".zip") {
			await this.installModZip(source, dest, setExtractionProgress);
			const mod = await parseZipFile(source);
			return mod;
		} else if (path.extname(source).toLowerCase() === ".pkz") {
			const trackType = await this.selectTrackType(modName);
			if (!trackType) return;
			const trackDest = await this.getInstallDest(
				modsFolder,
				source,
				trackType
			);
			await this.installModFile(source, trackDest);
			const mod: Mod = {
				name: modName,
				type: "track",
				trackType: trackType,
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

	/**
	 * Recursively delete all files from a FolderStructure.
	 * If folders are empty after deleting all files, those folders will also be deleted.
	 *
	 * @param folderStructure The FolderStructure object of the Mod
	 * @param currentDirectory The current directory that files/folders are being deleted from
	 */
	private deleteFolderStructure(
		folderStructure: FolderStructure,
		currentDirectory: string
	) {
		// For each file in current directory
		for (const file of folderStructure.files) {
			try {
				// rm the file
				fs.rmSync(path.join(currentDirectory, file));
			} catch (err) {
				// error, continue anyways to delete the rest
				console.error(err);
			}
		}
		try {
			// If the folder is empty, delete it
			if (this.isDirEmpty(currentDirectory)) {
				fs.rmdirSync(currentDirectory);
			}
		} catch (err) {
			console.error(err);
		}

		// For each subfolder name and FolderStructure associated with it
		for (const [k, v] of Object.entries(folderStructure.subfolders)) {
			// The current directory is the current directory plus the name of the current subfolder
			currentDirectory = path.join(currentDirectory, k);
			this.deleteFolderStructure(v, currentDirectory);
			// Reset the current directory because there may be other folders in the current directory that need to be deleted
			currentDirectory = path.dirname(currentDirectory);
		}
	}

	/**
	 * Determines if a directory is empty
	 *
	 * @param dirname The name of the directory
	 * @returns {boolean} Whether the directory is empty
	 */
	private isDirEmpty(dirname: string): boolean {
		let files;
		try {
			// This will return a list of the names of all files/folders in the directory
			files = fs.readdirSync(dirname);
		} catch (err) {
			console.error(err);
			return false;
		}

		return !files.length;
	}

	/**
	 * Installs a mod that needs to be unzipped
	 *
	 * @param source
	 * @param dest
	 * @param setExtractionProgress
	 */
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

	/**
	 * Prompts the user to select a ModType and returns the result
	 *
	 * @param modName The name of the mod
	 * @returns the ModType selected by the user
	 */
	private async selectModType(modName: string): Promise<ModType> {
		const modTypes: ModType[] = ["bike", "rider", "track", "tyre"];
		const result = await dialog.showMessageBox({
			type: "question",
			buttons: [
				...modTypes.map(
					(type) => type[0].toUpperCase() + type.slice(1) // Make mod types uppercase
				),
				"Cancel",
			],
			title: "Select Mod Type",
			message: `What type of mod is ${modName}?`,
			cancelId: 4, // If the user presses ESC or closes, it selects "Cancel"
		});

		if (result.response === 4) {
			console.log("User canceled mod type selection.");
			return null;
		}

		const modType = modTypes[result.response];
		return modType;
	}

	private async selectTrackType(
		trackName: string
	): Promise<TrackType | null> {
		const trackTypes: TrackType[] = [
			"supercross",
			"motocross",
			"supermoto",
			"enduro",
		];
		const title = "Select Track Type";
		const message = `What kind of track is ${trackName}?`;
		const trackType = await promptQuestion(title, message, trackTypes);

		return trackType as TrackType;
	}

	private async getInstallDest(
		modsFolder: string,
		modPath: string,
		trackType?: TrackType
	): Promise<string> {
		console.log("determinine install destination for mod path: ", modPath);
		const ext = path.extname(modPath).toLowerCase();
		console.log(ext);
		if (ext === ".pkz" && !trackType) return "tracks";
		if (ext === ".pkz" && trackType) {
			const trackName = path.basename(modPath);
			console.log("Got pkz");
			console.log("Got track type: ", trackType);
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
		const modPath = await promptSelectFile("Select A Mod To Install", [
			".zip",
			".pkz",
		]);
		return modPath;
	}
}
