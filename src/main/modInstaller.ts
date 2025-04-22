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
import { subdirExists } from "./utils/lib";

export default class ModInstaller {
	private hasModsSubdir(source: string) {}

	/**
	 * Installs a mod
	 * @param modsFolder The folder where the user's mods are located
	 * @param sendProgress A function to update the frontend with install progress
	 */
	public async installMod(
		modsFolder: string,
		sendProgress: (progress: number) => void,
		source?: string
	): Promise<Mod | void> {
		// Mod install process:
		// Stage 1: File selection
		// Stage 2: Add a custom name if desired, if not just use the file/folder name.
		// Stage 3: Check for a mods subdirectory.
		// Stage 4: If it has a mods subdirectory, install it and we're done!
		// Stage 5: No mods subdirectory, continue to manual installation process.
		// Stage 6: Manual installation process - Select Mod Type (Bike, Track, Rider, Other)
		// Stage 7: Case 1 - Bike => Copy pkz & folder with the same name as the pkz file (Create if not exists) to bikes folder.
		// Stage 8: Case 2 - Track => Select Track Type (SX, MX, Enduro, SM). Install pkz file to selected location.
		// Stage 9: Case 3 - Rider => Select Rider Mod Type (boots, helmet, gloves, rider)
		// Stage 10: If boots, copy pkz to boots folder.
		// Stage 11: If helmet, copy folder to helmets directory.
		// Stage 12: If gloves, Select which rider to install the gloves on, and copy the pnt to the correct location.
		// Stage 13: If riders, Copy the folder to the riders directory.

		// Stage 1: File selection
		if (!source) {
			source = await this.selectMod();
		}
		if (!source) {
			throw new Error("Cancelled mod install");
		}

		// Stage 2: Add a custom name if desired (Skip for now, QoL feature).

		// Stage 3: Check for a mods subdirectory IF the file type is zip or a folder.
		const modsSubdirLocation = subdirExists(source, "mods");
		if (modsSubdirLocation) {
		}

		const modName = path.basename(source).split(".pkz")[0];
		const modType = await this.selectModType(modName);

		const dest = await this.getInstallDest(modsFolder, source);
		console.log("Installing to : ", dest);

		if (dest === "") {
			return;
		}

		if (path.extname(source).toLowerCase() === ".zip") {
			await this.installModZip(source, dest, sendProgress);
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
	 * @param sendProgress
	 */
	private async installModZip(
		source: string,
		dest: string,
		sendProgress: (progress: number) => void
	) {
		await unzip(source, dest, sendProgress);
	}

	/**
	 * Copies a file from source to dest. Will create the directory recursively
	 * if it does not exist.
	 *
	 * @param source The path of the file
	 * @param dest The installation destination for the file
	 */
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
	private async selectModType(modName: string): Promise<ModType | null> {
		const modTypes: ModType[] = ["bike", "rider", "track", "tyre"];
		const title = "Select Mod Type";
		const message = `What type of mod is ${modName}?`;
		const result = await promptQuestion(title, message, modTypes);

		return result as ModType;
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
			return path.join(modsFolder, "tracks", trackType, trackName);
		} else if (ext === ".zip") {
			const hasModsSubdir = await zipHasModsSubdir(modPath, "mods");
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
			"zip",
			"pkz",
		]);
		return modPath;
	}
}
