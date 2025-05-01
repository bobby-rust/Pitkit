import unzip from "./utils/unzip";
import path from "path";
import fs from "fs";
import {
	FolderStructure,
	Mod,
	ModsData,
	ModType,
	RiderModType,
	TrackType,
} from "../types/types";
import { promptQuestion, promptSelectFile } from "./utils/dialogHelper";
import { subdirExists, isDir, extractRar } from "./utils/lib";
import extractZip from "./utils/unzip";

export default class ModInstaller {
	/**
	 * In the future, settings may be added,
	 * such as whether to move or copy the mod file
	 * when installing
	 */

	private modsFolder: string;
	private sendProgress: (progress: number) => void;

	constructor(modsFolder: string, sendProgress: (progress: number) => void) {
		console.log("Creating mod installer instance : ", modsFolder);
		this.modsFolder = modsFolder;
		this.sendProgress = sendProgress;
	}
	/**
	 * Installs a mod
	 * @param modsFolder The folder where the user's mods are located
	 * @param sendProgress A function to update the frontend with install progress
	 */
	public async installMod(
		sendProgress: (progress: number) => void,
		source?: string
	): Promise<Mod | void> {
		console.log("Iinstaling mod");
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

		// NOTE: Mod.from() does not set the track type.
		const mod: Mod = await Mod.from(source);

		// Stage 2: Add a custom name if desired (Skip for now, QoL feature).
		// Can set mod.name if a custom name is desired
		// const modName = path.parse(source).name;

		// Stage 3: Check for a mods subdirectory IF the file type is zip or a folder.
		console.log("Checking for mods subdir");
		const modsSubdirLocation = await subdirExists(source, "mods");
		console.log("Mods subdir location: ", modsSubdirLocation);
		if (modsSubdirLocation) {
			// path.dirname will do C:/Documents/mods -> C:/Documents
			const dest = path.dirname(this.modsFolder);

			if (isDir(source)) {
				this.cp(modsSubdirLocation, dest);
			} else if (path.extname(source) === ".zip") {
				// Extract to a temporary directory
				const tmpDir = path.join(__dirname, "tmp");
				await unzip(source, tmpDir, sendProgress);

				// Copy only the mods folder
				const tmpSrc = path.join(tmpDir, modsSubdirLocation);
				console.log("Temp src: ", tmpSrc);
				await this.cp(tmpSrc, dest);

				// Delete the temporary dir
				fs.rmSync(tmpDir, { recursive: true });
			}

			// Done! - All mod creators should structure their mod releases like this.
			// Unfortunately, they don't, so our job is harder
			return mod;
		}

		const modType = await this.selectModType(mod.name);
		console.log("Mod type selected: ", modType);
		mod.type = modType;
		switch (modType) {
			case "bike":
				return await this.installBikeMod(source, mod);
			case "track":
				return await this.installTrackMod(source, mod);
			case "rider":
				return await this.installRiderMod(source, mod);
			case "other":
				return await this.installOtherMod(source, mod);
		}
	}

	/**
	 * ======== Specific Install Methods ==========
	 *
	 * Mutates and returns the passed mod object
	 */

	/**
	 * All of the bike packs contain a mods folder for easy install, but
	 * if a bike mod does not contain that, this method will be used. Bikes just have a pkz file in the bikes directory,
	 * and a folder with the same name as the pkz file to store paints
	 */
	private async installBikeMod(
		source: string,
		mod: Mod
	): Promise<void | Mod> {
		throw new Error("Method not implemented.");
	}

	/**
	 * Tracks could be a pkz or (rarely) a zip or a rar, but they do not need to
	 * be extracted, the file can simply be copied to the destination.
	 */
	private async installTrackMod(
		source: string,
		mod: Mod
	): Promise<void | Mod> {
		const trackType = await this.selectTrackType(mod.name);
		mod.trackType = trackType;
		const dest = path.join(this.modsFolder, "tracks", trackType, mod.name);
		try {
			await this.cp(source, dest);
		} catch (err) {
			console.error(err);
		}

		return mod;
	}

	/**
	 * Supported rider mods are a whole rider, boots, gloves, or a helmet.
	 * Boots and helmets are not attached to a specific rider, but gloves are.
	 * If it's a whole rider, the folder can be moved to the rider/riders directory.
	 * Or if its a zip, it will need to be unzipped, but there must be a directory within the zip
	 * Some rider mods contain a "rider" directory that can simply be moved into the mods folder
	 */
	private async installRiderMod(
		source: string,
		mod: Mod
	): Promise<void | Mod> {
		console.log("Installing rider mod");
		const riderSubdir = await subdirExists(source, "rider");
		console.log("Rider subdir: ", riderSubdir);
		if (riderSubdir) {
			console.log("Rider subdirectory exists.");
			// Could be a zip here
			const dest = this.modsFolder; // rider exists under mods/
			if (path.extname(source) === ".zip") {
				await unzip(source, dest, this.sendProgress);
			} else if (isDir(source)) {
				await this.cp(source, dest);
			}

			// Done!
			return mod;
		}
		console.log("Rider subdirectory does not exist.");

		const riderModType: RiderModType = await this.selectRiderModType(
			mod.name
		);

		switch (riderModType) {
			case "boots":
				return await this.installBoots(source, mod);
			case "gloves":
				return await this.installGloves(source, mod);
			case "helmet":
				return await this.installHelmet(source, mod);
			case "rider":
				return await this.installRider(source, mod);
		}
	}

	private async installBoots(source: string, mod: Mod): Promise<Mod> {
		console.log("Installing boots");
		const bootsSubdir = await subdirExists(source, "boots");
		if (bootsSubdir) {
			// Copy boots to rider
			const dest = path.join(this.modsFolder, "rider");
			if (path.extname(source) === ".zip") {
				await unzip(source, dest, this.sendProgress);
			} else {
				this.cp(source, dest);
			}
		}

		// must be a pkz, if not idk
		if (path.extname(source) === ".pkz") {
			const dest = path.join(this.modsFolder, "rider", "boots");
			this.cp(source, dest);
		}

		return mod;
	}

	/**
	 * Gloves belong to a specific rider
	 * Gloves should be a .pnt file
	 */
	private async installGloves(source: string, mod: Mod): Promise<Mod> {
		// Get the available riders
		const riders = this.getRiders();
		console.log("Got riders: ", riders);
		// Then prompt the user to select a rider or riders to install the gloves to
		const title = "Select a rider";
		const message = "Select a rider for which to install the gloves";

		const rider = await promptQuestion(title, message, riders);

		console.log("Selected rider: ", rider);

		const ridersDir = path.join(this.modsFolder, "rider", "riders");

		const fileType = path.extname(source);

		if (!(fileType === ".pnt")) {
			throw new Error("Gloves should be a .pnt file");
		}

		await this.cp(source, path.join(ridersDir, rider, "gloves"));

		return mod;
	}

	/**
	 * Handles installation of both helmet models and helmet paints
	 *
	 * Installs either a helmet model or a helmet paint
	 *
	 * If the source is a pkz, it will be treated as a helmet model
	 * If the source is a pnt, it will be treated as a helmet paint
	 *
	 * If installing a helmet paint, it must be installed on the correct helmet, or it will not work.
	 * There is no way to tell what the correct helmet is or if the correct helmet was selected, that is up to the user.
	 *
	 * Helmet models could be a .rar or a folder. If it is any compressed file or a folder,
	 * the correct folders can be found by finding which subdirectories actually contain the helmet files.
	 * In mods/rider/helmets, the folders contain the helmet files or encrypted pkz files. They cannot be nested deeper within directories or they will not be found.
	 */
	private async installHelmet(source: string, mod: Mod): Promise<Mod> {
		// Get the directory of the helmets
		const helmetsDir = path.join(this.modsFolder, "rider", "helmets");

		const ext = path.extname(source);
		switch (ext) {
			case ".pkz":
				// New helmet model
				await this.cp(source, helmetsDir);
				break;
			case ".pnt":
				// Paint for existing helmet
				await this.installHelmetPnt(source);
				break;
			case ".rar":
				// Helmet pack, must be extracted and the folders containing
				// the helmet files must be found and installed
				await this.installHelmetRar(source);
				break;
			case ".zip":
				await this.installHelmetZip(source);
				break;
			case "":
				// a folder, treat the same way as an extracted rar
				await this.installHelmetsFolder(source);
				break;
			default:
				console.error(
					"Unrecognized file type for helmet model or paint: ",
					ext
				);
				throw new Error(
					"Unrecognized file type for helmet model or paint: " + ext
				);
		}

		return mod;
	}

	private async installRider(source: string, mod: Mod): Promise<Mod> {
		return mod;
	}

	private async installHelmetZip(source: string) {
		const tmpPath = path.join(__dirname, "tmp");
		await extractZip(source, tmpPath, () => null); // dummy function, no progress tracking
		await this.installHelmetsFolder(tmpPath);
	}

	private async installHelmetRar(source: string) {
		const tmpPath = path.join(__dirname, "tmp");

		await extractRar(source, tmpPath);

		// let's look for helmet.edf as that seems to hold the juice for helmet models
		// If a directory contains a helmet.edf, that helmet goes in modsFolder/rider/helmets

		await this.installHelmetsFolder(tmpPath);

		fs.rmSync(tmpPath, { recursive: true });
	}

	private async installHelmetsFolder(source: string) {
		const helmetDirs = this.findHelmetEdfs(source);
		console.log("Got helmet dirs: ", helmetDirs);
		for (const helmetDir of helmetDirs) {
			await this.cp(
				helmetDir,
				path.join(this.modsFolder, "rider", "helmets")
			);
		}
	}

	/**
	 * Given a path to a directory, returns a list of all folders containing a helmet.edf
	 */
	private findHelmetEdfs(source: string): string[] {
		console.log("Finding helmet efs in ", source);
		const helmetDirs: string[] = [];
		const subfolders = fs.readdirSync(source);
		console.log(subfolders);

		for (const subfolder of subfolders) {
			const subfolderPath = path.join(source, subfolder);
			const ext = path.extname(subfolder);

			// NOTE: This is a workaround for now, this should be refactored later
			// IF we find a pkz, that needs to be moved into the helmets dir just like a folder
			// These concerns should probably be separated
			if (ext === ".pkz") helmetDirs.push(subfolderPath);

			if (subfolder === "helmet.edf" || subfolder === "paints") {
				console.log("Found helmet path in ", subfolderPath);
				helmetDirs.push(source);
			} else if (isDir(subfolderPath)) {
				console.log("Found subdirectory...", subfolder);
				const result = this.findHelmetEdfs(subfolderPath);
				helmetDirs.push(...result);
			}
		}
		return helmetDirs;
	}

	private async installHelmetPnt(source: string) {
		const helmetsDir = path.join(this.modsFolder, "rider", "helmets");
		// Helmet paint for existing helmet model
		// cp will create the paints folder automatically

		// Need to select a helmet to install the paint into
		const helmets = this.getHelmets();
		const title = "Select a helmet";
		const message = "Select a helmet to install the paint on";
		const helmetFile = await promptQuestion(title, message, helmets);

		const ext = path.extname(helmetFile);
		const helmetFolder = helmetFile.split(ext)[0];
		const paintsFolder = path.join(helmetsDir, helmetFolder, "paints");
		console.log("installing to paints folder: ", paintsFolder);
		this.cp(source, paintsFolder);
	}

	private getHelmets(): string[] {
		const files = fs.readdirSync(
			path.join(this.modsFolder, "rider", "helmets")
		);
		return files;
	}

	private getRiders(): string[] {
		const files = fs.readdirSync(
			path.join(this.modsFolder, "rider", "riders")
		);
		return files;
	}

	private async selectRiderModType(modName: string): Promise<RiderModType> {
		const types: RiderModType[] = ["boots", "gloves", "helmet", "rider"];
		const riderModType = await promptQuestion(
			"Select Rider Mod Type",
			`What type of rider mod is ${modName}?`,
			types
		);
		return riderModType as RiderModType;
	}

	private async installOtherMod(
		source: string,
		mod: Mod
	): Promise<void | Mod> {
		throw new Error("Method not implemented.");
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
	 * Copies a file from source to dest. Will create the directory recursively
	 * if it does not exist.
	 *
	 * @param source The path of the file
	 * @param dest The path of the directory the file will be copied to, will be created if it does not exist
	 */
	private async cp(source: string, dest: string) {
		if (!fs.existsSync(dest)) {
			console.log("Directory does not exist, creating directory:", dest);
			fs.mkdirSync(dest, { recursive: true });
		}

		console.log("Copying to dest: ", dest);

		const fileName = path.basename(source);
		const destFile = path.join(dest, fileName);
		try {
			await fs.promises
				.cp(source, destFile, { recursive: true })
				.catch((err) => console.error("Error in cp: ", err));
		} catch (err) {
			console.log("Error in copy func: ", err);
			throw new Error("Unable to install mod: ", err);
		}
	}

	/**
	 * Prompts the user to select a ModType and returns the result
	 *
	 * @param modName The name of the mod
	 * @returns the ModType selected by the user
	 */
	private async selectModType(modName: string): Promise<ModType | null> {
		const modTypes: ModType[] = ["bike", "rider", "track", "other"];
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

	private async selectMod() {
		const modPath = await promptSelectFile("Select A Mod To Install", [
			"zip",
			"pkz",
			"pnt",
			"rar",
		]);
		return modPath;
	}
}
