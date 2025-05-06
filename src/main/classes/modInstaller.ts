import path from "path";
import os from "os";
import fs from "fs";

import {
	FolderEntries,
	Mod,
	ModsData,
	ModType,
	RiderModType,
	TrackType,
} from "../../types";

import { promptQuestion, promptSelectFile } from "../utils/dialogHelper";

import Decompressor from "./Decompressor";
import FolderStructureBuilder from "../services/FolderStructureBuilder";
import { ArchiveScanner } from "../services/ArchiveScanner";
import { cpRecurse, isDir } from "../utils/FileSystemUtils";
import { getModTypeFromModsSubdir } from "../services/ModClassifier";
import FolderStructureDeleter from "../services/FolderStructureDeleter";

/**
 * TODO:
 * This class is grossly in need of a refactor.
 * [ ] - Bike paints install
 * [ ] - Rider install
 * [ ] - Rider gear install
 * [ ] - Protections install
 * [ ] - helmet cams install
 * [ ] - Boots install that aren't pkzs
 * [ ] - Boot paints install, just like helmets, boots can have paints
 * [ ] - animations install
 * [ ] - fonts install
 * [ ] - pitboard..? what even is that
 * [ ] - allow selecting folders when selecting mod to install
 * [ ] - accept password inputs during extraction process
 * [ ] - Search for the correct files instead of trusting that
 * 		 mods passed with a mods subdir have the correct structure
 *
 * For cases where there is no mods subdir, it is fine to build folder
 * entries manually since we're installing the mod manually,
 * no need to extract to tmpdir then build the mods folder ourselves.
 * We can also search for the correct files instead of trusting that the user passed the
 * actual pkz when they may have passed a folder or archive containing a pkz.
 *
 * There are cases where the mods weren't packed correctly and contain a mods subdir
 * but with the wrong structure so the mod won't install correctly. For example,
 * I have personally seen SomeMod/mods/bikes/mod/bikes/<actual bike mod> on SMOEM_v0.15.1_full.zip
 * which is the __official__(!!) OEM supermoto v15.1 bikes found at https://mxb-mods.com/supermoto-oem-v0-15-1/
 * So that won't install correctly.
 *
 *
 */
export default class ModInstaller {
	/**
	 * In the future, settings may be added,
	 * such as whether to move or copy the mod file
	 * when installing
	 */

	private modsFolder: string;
	private tmpDir: string;
	private decompressor: Decompressor;
	private archiveScanner: ArchiveScanner;

	constructor(modsFolder: string, sendProgress: (progress: number) => void) {
		this.modsFolder = modsFolder;
		this.tmpDir =
			process.env.NODE_ENV === "development"
				? path.join(__dirname, "tmp")
				: path.join(os.tmpdir(), "PitkitExtract");

		console.log("Temp dir: ", this.tmpDir);
		this.decompressor = new Decompressor(sendProgress);
		this.archiveScanner = new ArchiveScanner();
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

		// If source is a folder, this will hold an absolute path.
		// If it is a rar or zip, this will hold a path relative to source.
		const pathToModsSubdir = await this.archiveScanner.subdirExists(
			source,
			"mods"
		);

		console.log("Mods subdir location: ", pathToModsSubdir);
		if (pathToModsSubdir) {
			await this.installWithModsSubdir(mod, source, pathToModsSubdir);
			sendProgress(100);

			fs.rmSync(this.tmpDir, { recursive: true });
			return mod;
		}

		// Stage 4: No mods subdir, continue with manual install
		const modType = await this.selectModType(mod.name);
		console.log("Mod type selected: ", modType);
		mod.type = modType;
		switch (modType) {
			case "bike":
				await this.installBikeMod(mod, source);
				break;
			case "track":
				await this.installTrackMod(mod, source);
				break;
			case "rider":
				await this.installRiderMod(mod, source);
				break;
			case "other":
				await this.installOtherMod(mod, source);
				break;
		}

		fs.rmSync(this.tmpDir, { recursive: true });
		return mod;
	}

	public setModsFolder(modsFolder: string) {
		this.modsFolder = modsFolder;
	}

	private async installWithModsSubdir(
		mod: Mod,
		source: string,
		modsSubdirLocation: string
	) {
		// path.dirname will do C:\Users\bob\Documents\PiBoSo\MX Bikes\mods -> C:\Users\bob\Documents\PiBoSo\MX Bikes
		const dest = path.dirname(this.modsFolder);

		const ext = path.extname(source);
		const tmpDest = path.join(this.tmpDir, mod.name);

		let modSource;
		switch (ext) {
			case ".zip":
			case ".rar":
				await this.decompressor.extract(source, tmpDest);
				// If the mod source was a compressed file, modsSubdirLocation is a relative path,
				// so build the absolute path
				modSource = path.join(
					this.tmpDir,
					mod.name,
					modsSubdirLocation
				);
				break;
			case "":
				// Already a folder, no need to extract
				modSource = modsSubdirLocation;
				break;
			default:
				console.error("Unrecognized file type: ", ext);
				throw new Error("Unrecognized file type " + ext);
		}

		await cpRecurse(modSource, dest);
		mod.files = FolderStructureBuilder.build(modSource);
		mod.type = getModTypeFromModsSubdir(modSource);

		// Done! - All mod creators should structure their mod releases like this.
		// Unfortunately, they don't, so our job is harder
		console.log("Returning mod: ", mod);
		return mod;
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
		mod: Mod,
		source: string
	): Promise<void | Mod> {
		// Search for a pkz.
		// When a pkz is found, it goes in mods/bikes/<bike.pkz>
		// Furthermore, a folder is created with the same name as the pkz file
		// and within the folder, a paints folder exists to install paints for that bike.
		mod.type = "bike";

		const dest = path.join(this.modsFolder, "bikes");
		const ft = path.extname(source);
		const modName = path.basename(source, ".pkz");
		let entries: FolderEntries;
		switch (ft) {
			case ".pkz":
				// Extract the file name, removing the file type suffix
				await cpRecurse(source, dest);
				const bikeFolderDest = path.join(dest, modName);
				fs.mkdirSync(bikeFolderDest);
				const paintsFolderDest = path.join(bikeFolderDest, "paints");
				fs.mkdirSync(paintsFolderDest);

				entries = {
					files: [],
					subfolders: {
						bikes: {
							files: [path.basename(source)],
							subfolders: {
								[modName]: {
									files: [],
									subfolders: {
										paints: {
											files: [],
											subfolders: {},
										},
									},
								},
							},
						},
					},
				};

				mod.files.setEntries(entries);
				return mod;
			case ".pnt":
				const title = "Select bike";
				const message = "Which bike is this paint for?";
				const bikes = this.getBikes();
				const bike = await promptQuestion(title, message, bikes);
				if (bike) {
					const paintsDir = path.join(
						this.modsFolder,
						"bikes",
						bike.split(".pkz")[0],
						"paints"
					);
					await cpRecurse(source, paintsDir);
				} else {
					throw new Error("Unable to install bike paint");
				}

				entries = {
					files: [],
					subfolders: {
						bikes: {
							files: [],
							subfolders: {
								[bike.split(".pkz")[0]]: {
									files: [],
									subfolders: {
										paints: {
											files: [path.basename(source)],
											subfolders: {},
										},
									},
								},
							},
						},
					},
				};
				mod.files.setEntries(entries);
				return mod;
			case ".zip":
			case ".rar":
				const tmpDest = path.join(this.tmpDir, path.parse(source).name);
				await this.decompressor.extract(source, tmpDest);
				const paints = this.findFilesByType(tmpDest, "pnt");
				if (paints) {
					const title = "Select bike";
					const message = "Which bike is this paint for?";
					const bikes = this.getBikes();
					const bike = await promptQuestion(title, message, bikes);
					if (bike) {
						const paintsDir = path.join(
							this.modsFolder,
							"bikes",
							bike.split(".pkz")[0],
							"paints"
						);
						for (const pnt of paints) {
							await cpRecurse(pnt, paintsDir);
						}
					} else {
						throw new Error("Unable to install bike paint");
					}

					entries = {
						files: [],
						subfolders: {
							bikes: {
								files: [],
								subfolders: {
									[bike.split(".pkz")[0]]: {
										files: [],
										subfolders: {
											paints: {
												files: paints.map((pnt) =>
													path.basename(pnt)
												),
												subfolders: {},
											},
										},
									},
								},
							},
						},
					};
					mod.files.setEntries(entries);
					return mod;
				} else {
					// Try to find pkz
					const pkzs = this.findFilesByType(source, "pkz");
					if (pkzs) {
						// TODO: finish this
					}
				}
		}
	}

	private getBikes(): string[] {
		const bikesDir = path.join(this.modsFolder, "bikes");
		const entries = fs.readdirSync(bikesDir);
		const bikes = [];
		for (const entry of entries) {
			if (path.extname(entry) === ".pkz") {
				bikes.push(entry);
			}
		}

		return bikes;
	}

	/**
	 * Tracks could be a pkz or (rarely) a zip or a rar, but they do not need to
	 * be extracted, the file can simply be copied to the destination.
	 */
	private async installTrackMod(
		mod: Mod,
		source: string
	): Promise<void | Mod> {
		// TODO: to make this function more robust, search for a pkz file,
		// and handle cases where it is not a pkz
		const trackType = await this.selectTrackType(mod.name);
		mod.trackType = trackType;
		const dest = path.join(this.modsFolder, "tracks", trackType);
		try {
			await cpRecurse(source, dest);
		} catch (err) {
			console.error(err);
		}

		// The FolderStructure of the mod is unknown up until this point for a track pkz
		const entries: FolderEntries = {
			files: [],
			subfolders: {
				tracks: {
					files: [],
					subfolders: {
						[trackType]: {
							files: [path.basename(source)],
							subfolders: {},
						},
					},
				},
			},
		};

		mod.files.setEntries(entries);
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
		mod: Mod,
		source: string
	): Promise<void | Mod> {
		mod.type = "rider";
		console.log("Installing rider mod");
		const riderSubdir = await this.archiveScanner.subdirExists(
			source,
			"rider"
		);
		console.log("Rider subdir: ", riderSubdir);
		if (riderSubdir) {
			console.log("Rider subdirectory exists.");
			// Could be a zip here
			const dest = this.modsFolder; // rider exists under mods/
			if (path.extname(source) === ".zip") {
				await this.decompressor.extract(source, dest);
			} else if (isDir(source)) {
				await cpRecurse(source, dest);
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
				return await this.installBoots(mod, source);
			case "gloves":
				return await this.installGloves(mod, source);
			case "helmet":
				return await this.installHelmet(mod, source);
			case "rider":
				return await this.installRider(mod, source);
		}
	}

	private async installBoots(mod: Mod, source: string): Promise<Mod> {
		console.log("Installing boots");
		const bootsSubdir = await this.archiveScanner.subdirExists(
			source,
			"boots"
		);
		if (bootsSubdir) {
			// Copy boots to rider
			const dest = path.join(this.modsFolder, "rider");
			if (path.extname(source) === ".zip") {
				await this.decompressor.extract(source, dest);
			} else {
				await cpRecurse(source, dest);
			}
		}

		const ft = path.extname(source);
		// must be a pkz, if not idk
		switch (ft) {
			case ".pkz":
				const dest = path.join(this.modsFolder, "rider", "boots");
				await cpRecurse(source, dest);
				break;
			// Fallthrough case is intentional for compressed files
			case ".zip":
			case ".rar":
				const tmpDest = path.join(this.tmpDir, path.parse(source).name);
				await this.decompressor.extract(source, tmpDest);
				const pkzs = this.findFilesByType(tmpDest, "pkz");
				if (pkzs) {
					const dest = path.join(this.modsFolder, "rider", "boots");
					for (const pkz of pkzs) {
						await cpRecurse(pkz, dest);
						// TODO: create the paints folder for the boots ?
					}

					const entries: FolderEntries = {
						files: [],
						subfolders: {
							rider: {
								files: [],
								subfolders: {
									boots: {
										files: pkzs.map((pkz) =>
											path.basename(pkz)
										),
										subfolders: {},
									},
								},
							},
						},
					};

					mod.files.setEntries(entries);

					return mod;
				} else {
					await this.installBootsFolder(mod, tmpDest);
					return mod;
				}
		}

		// This is used if the file type was a single pkz
		// If it was a folder or an archive, we should return before hitting this
		const entries: FolderEntries = {
			files: [],
			subfolders: {
				rider: {
					files: [],
					subfolders: {
						boots: {
							files: [path.basename(source)],
							subfolders: {},
						},
					},
				},
			},
		};

		mod.files.setEntries(entries);

		return mod;
	}

	private async installBootsFolder(mod: Mod, source: string) {
		const bootsDirs = this.findEdfs(source, "helmet");

		const entries: FolderEntries = { files: [], subfolders: {} };

		for (const bootsDir of bootsDirs) {
			const gogglesPath = path.join(bootsDir, "goggles");
			const paintsPath = path.join(bootsDir, "paints");
			if (!fs.existsSync(gogglesPath)) {
				fs.mkdirSync(gogglesPath);
			}
			if (!fs.existsSync(paintsPath)) {
				fs.mkdirSync(paintsPath);
			}

			await cpRecurse(
				bootsDir,
				path.join(this.modsFolder, "rider", "boots")
			);

			// each of these helmet dirs is a whole helmet model in itself.
			// They can be treated as a single mod
			const root = FolderStructureBuilder.build(bootsDir);
			entries.subfolders[path.basename(bootsDir)] = root.getEntries();
		}

		const root: FolderEntries = {
			files: [],
			subfolders: {
				rider: {
					files: [],
					subfolders: {
						helmets: {
							files: [],
							subfolders: entries.subfolders,
						},
					},
				},
			},
		};

		mod.files.setEntries(root);
		return mod;
	}

	/**
	 * Gloves belong to a specific rider
	 * Gloves should be a .pnt file
	 */
	private async installGloves(mod: Mod, source: string): Promise<Mod> {
		// Get the available riders
		const riders = this.getRiders();
		console.log("Got riders: ", riders);
		// Then prompt the user to select a rider or riders to install the gloves to
		const title = "Select a rider";
		const message = "Select a rider for which to install the gloves";

		const rider = await promptQuestion(title, message, riders);

		console.log("Selected rider: ", rider);

		const ridersDir = path.join(this.modsFolder, "rider", "riders");

		const glovesDir = path.join(ridersDir, rider, "gloves");
		const fileType = path.extname(source);

		let pnts: string[];
		if (!(fileType === ".pnt")) {
			if (fileType === ".zip" || fileType === ".rar") {
				const tmpDest = path.join(this.tmpDir, mod.name);
				await this.decompressor.extract(source, tmpDest);
				pnts = this.findFilesByType(tmpDest, "pnt");
				console.log("Found pnts: ", pnts);
				for (const pnt of pnts) {
					await cpRecurse(pnt, glovesDir);
				}
			} else if (fs.statSync(source).isDirectory()) {
				pnts = this.findFilesByType(source, "pnt");
				for (const pnt of pnts) {
					await cpRecurse(pnt, glovesDir);
				}
			}
		} else {
			await cpRecurse(source, glovesDir);
		}

		// If we got a bunch of pnts, use that, else if source was a single pnt, use that
		const glovesFiles = pnts
			? pnts.map((pnt) => path.basename(pnt))
			: [path.basename(source)];

		const entries: FolderEntries = {
			files: [],
			subfolders: {
				rider: {
					files: [],
					subfolders: {
						riders: {
							files: [],
							subfolders: {
								[rider]: {
									files: [],
									subfolders: {
										gloves: {
											files: glovesFiles,
											subfolders: {},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		mod.files.setEntries(entries);
		return mod;
	}

	// Returns an array of absolute paths to pnt files recursively within source
	// Source must be a directory
	// Do not pass the "."
	private findFilesByType(source: string, target: string): string[] {
		console.log("Finding files of type " + target + " in ", source);
		if (!fs.statSync(source).isDirectory()) {
			return [];
		}

		const files: string[] = [];
		const entries = fs.readdirSync(source);
		console.log("Got entries: ", entries);
		entries.forEach((entry) => {
			const fullPath = path.join(source, entry);
			if (fs.statSync(fullPath).isDirectory()) {
				files.push(...this.findFilesByType(fullPath, target));
			} else {
				const ft = path.extname(entry);
				if (ft === "." + target) {
					files.push(fullPath);
				}
				// Maybe check for more compressed files here cause ya never know with these ppl
				// im just too lazy to do that rn
			}
		});

		return files;
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
	private async installHelmet(mod: Mod, source: string): Promise<Mod> {
		// make sure the mod type is correct if the user manually selected helmet
		mod.type = "rider";

		// Get the directory of the helmets
		const helmetsDir = path.join(this.modsFolder, "rider", "helmets");

		if (fs.statSync(source).isDirectory()) {
			// a folder, treat the same way as an extracted rar
			await this.installHelmetsFolder(mod, source);
			return mod;
		}

		const ext = path.extname(source);
		switch (ext) {
			case ".pkz":
				// New helmet model
				await this.installHelmetPkz(mod, source, helmetsDir);
				break;
			case ".pnt":
				// Paint for existing helmet
				await this.installHelmetPnt(mod, source);
				break;
			case ".rar":
				// Helmet pack, must be extracted and the folders containing
				// the helmet files must be found and installed
				await this.installHelmetRar(mod, source);
				break;
			case ".zip":
				await this.installHelmetZip(mod, source);
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

	private async installRider(mod: Mod, source: string): Promise<Mod> {
		throw new Error("Method not implemented");
	}

	private async installHelmetPkz(mod: Mod, source: string, dest: string) {
		const fileName = path.basename(source, ".pkz");
		console.log("File name: ", fileName);
		const entries: FolderEntries = {
			files: [],
			subfolders: {
				rider: {
					files: [],
					subfolders: {
						helmets: {
							files: [path.basename(source)],
							subfolders: {
								// Subfolder holding paints and goggles needs to have the same name as the pkz file
								[fileName]: {
									files: [],
									subfolders: {
										goggles: {
											files: [],
											subfolders: {},
										},
										paints: {
											files: [],
											subfolders: {},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		mod.files.setEntries(entries);

		fs.writeFileSync(
			"entries.json",
			JSON.stringify(mod.files.getEntries())
		);
		await cpRecurse(source, dest);

		this.makeHelmetFolder(fileName);

		return mod;
	}

	private async installHelmetZip(mod: Mod, source: string) {
		await this.decompressor.extract(source, this.tmpDir);
		await this.installHelmetsFolder(mod, this.tmpDir);
	}

	private async installHelmetRar(mod: Mod, source: string) {
		await this.decompressor.extract(source, this.tmpDir);

		// let's look for helmet.edf as that seems to hold the juice for helmet models
		// If a directory contains a helmet.edf, that directory goes in modsFolder/rider/helmets

		await this.installHelmetsFolder(mod, this.tmpDir);
	}

	private async installHelmetsFolder(mod: Mod, source: string) {
		const helmetDirs = this.findEdfs(source, "helmet");

		const entries: FolderEntries = { files: [], subfolders: {} };

		for (const helmetDir of helmetDirs) {
			const gogglesPath = path.join(helmetDir, "goggles");
			const paintsPath = path.join(helmetDir, "paints");
			if (!fs.existsSync(gogglesPath)) {
				fs.mkdirSync(gogglesPath);
			}
			if (!fs.existsSync(paintsPath)) {
				fs.mkdirSync(paintsPath);
			}

			await cpRecurse(
				helmetDir,
				path.join(this.modsFolder, "rider", "helmets")
			);

			// each of these helmet dirs is a whole helmet model in itself.
			// They can be treated as a single mod
			const root = FolderStructureBuilder.build(helmetDir);
			entries.subfolders[path.basename(helmetDir)] = root.getEntries();
		}

		const root: FolderEntries = {
			files: [],
			subfolders: {
				rider: {
					files: [],
					subfolders: {
						helmets: {
							files: [],
							subfolders: entries.subfolders,
						},
					},
				},
			},
		};

		mod.files.setEntries(root);
		return mod;
	}

	private makeHelmetFolder(name: string) {
		const folderDest = path.join(this.modsFolder, "rider", "helmets", name);
		try {
			fs.mkdirSync(folderDest);
			fs.mkdirSync(path.join(folderDest, "goggles"));
			fs.mkdirSync(path.join(folderDest, "paints"));
		} catch (e) {
			console.error(e);
		}
	}

	/**
	 * Given a path to a directory, returns a list of all folders containing a helmet.edf
	 */
	private findEdfs(source: string, target: string): string[] {
		console.log("Finding helmet efs in ", source);
		const edfDirs: string[] = [];
		let folderEntries;
		try {
			folderEntries = fs.readdirSync(source);
		} catch (e) {
			console.error(e);
			return [];
		}
		console.log(folderEntries);

		for (const entry of folderEntries) {
			const subfolderPath = path.join(source, entry);
			const ext = path.extname(entry);

			// NOTE: This is a workaround for now, this should be refactored later
			// IF we find a pkz, that needs to be moved into the helmets dir just like a folder
			// These concerns should probably be separated
			if (ext === ".pkz") edfDirs.push(subfolderPath);

			if (entry === target + ".edf") {
				console.log("Found edf path in ", subfolderPath);
				edfDirs.push(source);
			} else if (isDir(subfolderPath)) {
				console.log("Found subdirectory...", entry);
				const result = this.findEdfs(subfolderPath, target);
				edfDirs.push(...result);
			}
		}

		return edfDirs;
	}

	private async installHelmetPnt(mod: Mod, source: string) {
		const helmetsDir = path.join(this.modsFolder, "rider", "helmets");
		// Helmet paint for existing helmet model
		// cpRecurse will create the paints folder automatically

		// Need to select a helmet to install the paint into
		const helmets = this.getHelmets();
		const title = "Select a helmet";
		const message = "Select a helmet to install the paint on";
		const helmetFile = await promptQuestion(title, message, helmets);

		const fullPath = path.join(helmetsDir, helmetFile);
		let helmetFolder;
		if (fs.statSync(fullPath).isDirectory()) {
			helmetFolder = helmetFile;
		} else {
			helmetFolder = path.basename(helmetFile, ".pnt");
		}

		const paintsFolder = path.join(helmetsDir, helmetFolder, "paints");
		console.log("installing to paints folder: ", paintsFolder);
		await cpRecurse(source, paintsFolder);

		const entries: FolderEntries = {
			files: [],
			subfolders: {
				rider: {
					files: [],
					subfolders: {
						helmets: {
							files: [],
							subfolders: {
								[helmetFolder]: {
									files: [],
									subfolders: {
										paints: {
											files: [path.basename(source)],
											subfolders: {},
										},
									},
								},
							},
						},
					},
				},
			},
		};

		mod.files.setEntries(entries);
		return mod;
	}

	private async installOtherMod(
		mod: Mod,
		source: string
	): Promise<void | Mod> {
		throw new Error("Method not implemented.");
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

	public async uninstallMod(mods: ModsData, modName: string) {
		const modToRemove = mods.get(modName);
		FolderStructureDeleter.delete(modToRemove.files, this.modsFolder);
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

	/**
	 * Prompts the user to select a ModType and returns the result
	 *
	 * @param modName The name of the mod
	 * @returns the ModType selected by the user
	 */
	private async selectModType(modName: string): Promise<ModType | null> {
		const modTypes: ModType[] = ["bike", "rider", "track"];
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
