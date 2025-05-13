import Decompressor from "./Decompressor";
import path from "path";
import os from "os";
import fs from "fs";
import { Mod, ModType } from "../../types";
import { cpRecurse, findDirectoriesContainingFileName, findFilesByType, findDeepestSubdir } from "../utils/FileSystemUtils";
import { promptQuestion } from "../utils/dialogHelper";

import log from "electron-log/main";
import FolderStructure from "../models/FolderStructure";
import { ModalManager } from "./ModalManager";
import { mainWindow } from "../main";

/**
 * TODO:
 * [ ] - Recursive extraction
 * [ ] - Extract files with passwords
 * [ ] - Install fonts
 * [ ] - Install stands
 * [ ] - Install rider animations
 * [ ] - Install modpacks ( bike packs that contain multiple pnts for different bikes, need to ask if all pnts are for same object or different )
 * [ ] - Install menu backgrounds
 * [ ] - Install MaxHUD
 * [ ] - Install Reshade presets
 * [ ] - Install UI mods
 * [ ] - Install translations
 */
class ModInstaller {
	#modsFolder: string;
	#tmpDir: string;
	#decompressor: Decompressor;
	#modalManager: ModalManager;

	constructor(modsFolder: string, sendProgress: (progress: number) => void) {
		this.#modsFolder = modsFolder;
		this.#tmpDir =
			process.env.NODE_ENV === "development" ? path.join(__dirname, "tmp") : path.join(os.tmpdir(), "PitkitExtract");

		log.info("ModInstaller constructor: temp dir set to", this.#tmpDir);

		this.#decompressor = new Decompressor(sendProgress);
		log.info("ModInstaller constructor: Decompressor initialized");

		this.#modalManager = new ModalManager();
		log.info("ModInstaller constructor: ModalManager initialized");
	}

	public setModsFolder(modsFolder: string) {
		this.#modsFolder = modsFolder;
		log.info("setModsFolder: modsFolder updated to", modsFolder);
	}

	async uninstall(mod: Mod) {
		log.info("uninstall: deleting files for mod", mod.name);
		mod.files.delete(this.#modsFolder);
		log.info("uninstall: completed for mod", mod.name);
	}

	async install(source: string) {
		log.info("install: starting installation for source", source);
		const mod: Mod = Mod.from(source);

		const modName = await this.#modalManager.promptText(
			mainWindow,
			"Enter mod name",
			"Enter a name for this mod",
			mod.name
		);
		mod.name = modName;

		let tmpSrc: string = path.join(this.#tmpDir, mod.name);

		try {
			if (!fs.statSync(source).isDirectory()) {
				const ft = path.extname(source);
				log.info("install: detected file type", ft);
				switch (ft) {
					case ".zip":
					case ".rar":
						log.info("install: extracting archive", source, "to", tmpSrc);
						await this.#decompressor.extract(source, tmpSrc);
						log.info("install: extraction successful");
						break;
					case ".pnt":
						log.info("install: copying pnt/pkz file", source, "to", tmpSrc);
						await cpRecurse(source, tmpSrc);
						log.info("install: copy successful");
						break;
					case ".pkz":
						log.info("install: copying pnt/pkz file", source, "to", tmpSrc);
						await cpRecurse(source, tmpSrc);
						log.info("install: copy successful");

						const newTmpSrc = await this.#pkzToZip(path.join(tmpSrc, path.basename(source)));
						log.info("pkz to zip result: ", newTmpSrc);

						if (newTmpSrc) {
							log.info("install: setting tmpSrc to ", newTmpSrc);
							tmpSrc = newTmpSrc;
						}
						break;
					default:
						log.error("install: unknown file type", ft);
						throw new Error("Unknown file type for mod: '" + ft + "'");
				}
			} else {
				log.info("install: source is directory, copying to", tmpSrc);
				await cpRecurse(source, tmpSrc);
				log.info("install: directory copy successful");
			}

			const modsSubdirLocation = findDeepestSubdir(tmpSrc, "mods");
			log.info("install: modsSubdirLocation found", modsSubdirLocation);

			if (modsSubdirLocation) {
				mod.type = this.#getModTypeFromModsSubdir(modsSubdirLocation);
				log.info("install: mod type determined", mod.type);
				await cpRecurse(modsSubdirLocation, path.dirname(this.#modsFolder));
				log.info("install: copied mods subdir to modsFolder");
				const folderStruct = FolderStructure.build(modsSubdirLocation);
				mod.files = folderStruct;
				log.info("install: installation complete for mod", mod.name);
				return mod;
			}

			log.info("install: proceeding with individual model installations");
			log.info("install: temp src location", tmpSrc);

			// Collect model files/directories
			const bootModels = findDirectoriesContainingFileName(tmpSrc, "boots.edf");
			log.info("install: found bootModels", bootModels);

			const riderModels = findDirectoriesContainingFileName(tmpSrc, "rider.edf");
			log.info("install: found riderModels", riderModels);

			const helmetModels = findDirectoriesContainingFileName(tmpSrc, "helmet.edf");
			log.info("install: found helmetModels", helmetModels);

			const bikeModels = findDirectoriesContainingFileName(tmpSrc, "model.edf");
			log.info("install: found bikeModels", bikeModels);

			const soundMods = findDirectoriesContainingFileName(tmpSrc, "engine.scl");
			log.info("install: found soundMods", soundMods);

			const wheelModels = findDirectoriesContainingFileName(tmpSrc, "p_mx.edf");
			log.info("install: found wheelModels", wheelModels);

			const tyreMods = findFilesByType(tmpSrc, "tyre");
			log.info("install: found tyreMods", tyreMods);

			const protectionModels = findDirectoriesContainingFileName(tmpSrc, "protection.edf");
			log.info("install: found protectionModels", protectionModels);

			const trackMaps = findFilesByType(tmpSrc, "map");
			log.info("install: found trackMaps", trackMaps);

			// Handle unrecognized edfs as if they were pkzs
			const unrecognizedEdfs = findFilesByType(tmpSrc, "edf", [
				...bootModels,
				...riderModels,
				...helmetModels,
				...bikeModels,
				...wheelModels,
				...protectionModels,
				// Track maps are absolute file paths, we want to exclude the whole directory
				...trackMaps.map((trackMap) => path.dirname(trackMap)),
			]);

			log.info("install: found unrecognized edfs", unrecognizedEdfs);

			// Create a set to keep track of which mods have been installed
			// A single mod can contain multiple EDFs in the same folder, so if EDFs
			// are in the same folder, they belong to the same mod.
			const unrecognizedEdfSourceSet = new Set();
			for (const unrecognizedEdf of unrecognizedEdfs) {
				const source = path.dirname(unrecognizedEdf);
				if (unrecognizedEdfSourceSet.has(source)) continue;
				unrecognizedEdfSourceSet.add(source);
				await this.#installUnrecognizedEDF(mod, source, tmpSrc);
			}

			for (const trackMap of trackMaps) {
				log.info("tmpSrc with track map:", tmpSrc);
				mod.type = "track";
				const trackFolder = await this.#selectTrackFolder(mod.name);
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "tracks", trackFolder);

				log.info("install: copying to tmpdest", tmpdest);
				await cpRecurse(path.dirname(trackMap), tmpdest);
			}

			// install all found edf files
			for (const bootModel of bootModels) {
				mod.type = "rider";
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "rider", "boots");
				await cpRecurse(bootModel, tmpdest);
			}

			for (const riderModel of riderModels) {
				mod.type = "rider";
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "rider", "riders");
				await cpRecurse(riderModel, tmpdest);
			}

			for (const helmetModel of helmetModels) {
				mod.type = "rider";
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets");
				await cpRecurse(helmetModel, tmpdest);
			}

			for (const bikeModel of bikeModels) {
				mod.type = "rider";
				const title = "Select a bike";
				const message = "Which bike is " + mod.name + " for?";
				const bikes = this.#getBikes();
				const bike = await promptQuestion(this.#modalManager, title, message, bikes);
				if (!bike) continue;
				const bikeModelFiles = fs.readdirSync(bikeModel);
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "bikes", bike?.split(".pkz")[0]);
				for (const file of bikeModelFiles) {
					await cpRecurse(path.join(bikeModel, file), tmpdest);
				}
			}

			for (const soundMod of soundMods) {
				mod.type = "bike";
				const title = "Select a bike";
				const message = "Which bike is " + mod.name + " for?";
				const bikes = this.#getBikes();
				const bike = await promptQuestion(this.#modalManager, title, message, bikes);
				if (!bike) continue;
				const bikeModelFiles = fs.readdirSync(soundMod);
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "bikes", bike?.split(".pkz")[0]);
				for (const file of bikeModelFiles) {
					await cpRecurse(path.join(soundMod, file), tmpdest);
				}
			}

			for (const wheelModel of wheelModels) {
				mod.type = "bike";
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "tyres");
				await cpRecurse(wheelModel, tmpdest);
			}

			for (const tyreMod of tyreMods) {
				mod.type = "bike";
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "tyres");
				await cpRecurse(path.dirname(tyreMod), tmpdest);
			}

			for (const protectionModel of protectionModels) {
				mod.type = "other";
				const tmpdest = path.join(path.dirname(tmpSrc), "mods", "rider", "protections");
				await cpRecurse(protectionModel, tmpdest);
			}

			// Now install PNTs and PKZs
			await this.#installPNTs(mod, tmpSrc, [...bootModels, ...riderModels, ...helmetModels, ...protectionModels]);
			log.info("install: installPNTs completed");
			await this.#installPKZs(mod, tmpSrc);
			log.info("install: installPKZs completed");

			const tmpModsLocation = path.join(path.dirname(tmpSrc), "mods");
			log.info("install: final copy from", tmpModsLocation, "to", path.dirname(this.#modsFolder));
			await cpRecurse(tmpModsLocation, path.dirname(this.#modsFolder));

			const folderStruct = FolderStructure.build(tmpModsLocation);
			mod.files = folderStruct;

			try {
				fs.rmSync(this.#tmpDir, { recursive: true });
				log.info("install: temp directory removed", this.#tmpDir);
			} catch (err) {
				log.error("install: error removing temp directory", err);
			}

			log.info("install: completed for mod", mod.name);
			return mod;
		} catch (err) {
			log.error("install: encountered error", err);
			throw err;
		}
	}

	// Converts a pkz to a zip and returns the path of the extracted folder, or null if extraction fails
	async #pkzToZip(source: string): Promise<string | null> {
		log.info("src passed to pkzToZip: ", source);

		// parse out directory, base name and extension
		const { dir, name, ext } = path.parse(source);

		// ensure it really was a .pkz (case-insensitive)
		if (ext.toLowerCase() !== ".pkz") {
			log.warn("non-pkz file passed to pkzToZip");
			return null;
		}

		const zipPath = path.join(dir, `${name}.zip`);
		fs.copyFileSync(source, zipPath);
		const extractFolder = path.join(dir, name);
		log.info("Zip path: ", zipPath);
		log.info("Extract folder: ", extractFolder);
		try {
			// Extract zip file to folder
			await this.#decompressor.extract(zipPath, extractFolder);
		} catch (err) {
			console.error("Error while extracting pkz file: ", err);
			return null;
		}

		return extractFolder;
	}

	/* ============================== Get Available Mods By Type =========================== */

	#getBikes(): string[] {
		const bikesDir = path.join(this.#modsFolder, "bikes");
		const entries = fs.readdirSync(bikesDir);
		const bikes = [];
		for (const entry of entries) {
			// I don't think bikes can be a directory... but I could be wrong...
			if (path.extname(entry) === ".pkz") {
				bikes.push(entry);
			}
		}

		return bikes;
	}

	#getTrackFolders(): string[] {
		const tracksDir = path.join(this.#modsFolder, "tracks");
		const entries = fs.readdirSync(tracksDir);
		const tracks: string[] = [];
		entries.forEach((entry) => {
			const fullPath = path.join(tracksDir, entry);
			if (fs.statSync(fullPath).isDirectory()) {
				tracks.push(entry);
			}
		});

		return tracks;
	}

	#getHelmets(): Set<string> {
		const helmetsDir = path.join(this.#modsFolder, "rider", "helmets");
		const helmets: Set<string> = new Set();
		const entries = fs.readdirSync(helmetsDir);
		entries.forEach((entry: string) => {
			if (fs.statSync(path.join(helmetsDir, entry)).isDirectory()) {
				helmets.add(entry);
			} else if (path.extname(entry) === ".pkz") {
				helmets.add(entry.split(".pkz")[0]);
			}
		});

		return helmets;
	}

	#getBoots(): Set<string> {
		const bootsDir = path.join(this.#modsFolder, "rider", "boots");
		const boots: Set<string> = new Set();
		const entries = fs.readdirSync(bootsDir);
		entries.forEach((entry: string) => {
			if (fs.statSync(path.join(bootsDir, entry)).isDirectory()) {
				boots.add(entry);
			} else if (path.extname(entry) === ".pkz") {
				boots.add(entry.split(".pkz")[0]);
			}
		});

		return boots;
	}

	// Used for both rider gear and gloves
	#getRiders(): string[] {
		const ridersDir = path.join(this.#modsFolder, "rider", "riders");
		const entries = fs.readdirSync(ridersDir);
		const riders = [];
		for (const entry of entries) {
			// I don't think a rider can be a pkz, but I could be wrong so this may need to be changed at some point to include pkzs

			if (fs.statSync(path.join(ridersDir, entry)).isDirectory()) {
				riders.push(entry);
			}
		}

		return riders;
	}

	#getProtections(): string[] {
		const protectionsDir = path.join(this.#modsFolder, "rider", "protections");
		const entries = fs.readdirSync(protectionsDir);
		const protections: string[] = [];
		entries.forEach((entry) => {
			if (fs.statSync(path.join(protectionsDir, entry)).isDirectory()) {
				protections.push(entry);
			} else if (path.extname(entry) === ".pkz") {
				protections.push(entry.split(".pkz")[0]);
			}
		});

		return protections;
	}

	/* ============================== Install by type ================================ */

	async #installUnrecognizedEDF(mod: Mod, source: string, tmpSrc: string) {
		log.info("install: handling unrecognized edf ", source);
		const edfType = await promptQuestion(
			this.#modalManager,
			"Select mod type",
			`What type of mod is ${path.basename(source)}?`,
			["helmets", "boots", "bikes", "tracks", "tyres", "protections", "helmet addon"]
		);
		log.info("install: edfType selected", edfType);
		let builtEdfsLocation: string;
		switch (edfType) {
			case "helmets":
				log.info("installPKZs: handling pkzType 'helmets'");
				mod.type = "rider";
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets");
				break;
			case "boots":
				log.info("installPKZs: handling pkzType 'boots'");
				mod.type = "rider";
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "boots");
				break;
			case "riders":
				log.info("installPKZs: handling pkzType 'riders'");
				mod.type = "rider";
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "riders");
				break;
			case "tracks":
				log.info("installPKZs: handling pkzType 'tracks'");
				mod.type = "track";
				const trackFolder = await this.#selectTrackFolder(mod.name);
				log.info("installPKZs: track folder determined", trackFolder);
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "tracks", trackFolder);
				break;
			case "bikes":
				log.info("installPKZs: handling pkzType 'bikes'");
				mod.type = "bike";
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "bikes");
				break;
			case "tyres":
				log.info("installPKZs: handling pkzType 'tyres'");
				mod.type = "bike";
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "tyres");
				break;
			case "protections":
				log.info("installPKZs: handling pkzType 'protections'");
				mod.type = "rider";
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "protections");
				break;
			case "helmet addon":
				log.info("installPKZs: handling pkzType 'helmet addon'");
				mod.type = "rider";
				builtEdfsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmetcams");
				break;
			default:
				log.warn("installPKZs: no valid pkz type selected, skipping PKZ installation");
				return;
		}
		log.info("install: unrecognized edf installing to location", builtEdfsLocation);
		await cpRecurse(source, builtEdfsLocation);
	}

	// Installs PNTs to tmp; still must be copied over later
	async #installPNTs(mod: Mod, tmpSrc: string, excludeDirs: string[]) {
		log.info("installPNTs: starting for mod", mod.name);
		const pnts = findFilesByType(tmpSrc, "pnt", excludeDirs);
		log.info("installPNTs: found pnt files", pnts);

		let paintType: string;
		if (pnts?.length) {
			log.info("installPNTs: prompting for paint type");
			paintType = await promptQuestion(
				this.#modalManager,
				"Select paint type",
				"What type of paints are you installing?",
				["helmets", "goggles", "boots", "gloves", "riders", "bikes", "protections"]
			);
			log.info("installPNTs: paintType selected", paintType);
		}

		let builtPaintsLocation: string;
		switch (paintType) {
			case "bikes":
				log.info("installPNTs: handling paintType 'bikes'");
				mod.type = "bike";
				const bikes = this.#getBikes();
				if (!bikes?.length) {
					log.error("installPNTs: no bikes available for paints");
					throw new Error("Unable to install bike paints, no available bikes");
				}
				const bikeChoice = await promptQuestion(
					this.#modalManager,
					"Select a bike",
					pnts.length === 1 ? "What bike does this paint belong to?" : "What bike do these paints belong to?",
					bikes
				);
				log.info("installPNTs: bike selected", bikeChoice);
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "bikes", bikeChoice.split(".pkz")[0], "paints");
				break;

			case "helmets":
				log.info("installPNTs: handling paintType 'helmets'");
				mod.type = "rider";
				const helmets = this.#getHelmets();
				if (!helmets?.size) {
					log.error("installPNTs: no helmets available for paints");
					throw new Error("No helmets installed, unable to install helmet paints");
				}
				const helmetChoice = await promptQuestion(
					this.#modalManager,
					"Select a helmet",
					pnts.length === 1 ? "Which helmet does this paint belong to?" : "What helmets do these paints belong to?",
					Array.from(helmets)
				);
				log.info("installPNTs: helmet selected", helmetChoice);
				const helmetFolder = path.extname(helmetChoice) === ".pkz" ? helmetChoice.split(".pkz")[0] : helmetChoice;
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets", helmetFolder, "paints");
				break;

			case "goggles":
				log.info("installPNTs: handling paintType 'goggles'");
				mod.type = "rider";
				const gogHelmets = this.#getHelmets();
				if (!gogHelmets?.size) {
					log.error("installPNTs: no helmets for goggles");
					throw new Error("No helmets installed, unable to install goggles");
				}
				const gogHelmetChoice = await promptQuestion(
					this.#modalManager,
					"Select a helmet",
					pnts.length === 1 ? "Which helmet are these goggles for?" : "What helmet is this pair of goggles for?",
					Array.from(gogHelmets)
				);
				log.info("installPNTs: goggles helmet selected", gogHelmetChoice);
				const gogHelmetFolder =
					path.extname(gogHelmetChoice) === ".pkz" ? gogHelmetChoice.split(".pkz")[0] : gogHelmetChoice;
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets", gogHelmetFolder, "goggles");
				break;

			case "boots":
				log.info("installPNTs: handling paintType 'boots'");
				mod.type = "rider";
				const bootSet = this.#getBoots();
				log.info("installPNTs: found boots", Array.from(bootSet));
				if (!bootSet?.size) {
					log.error("installPNTs: no boots available for paints");
					throw new Error("No boots installed, unable to install boot paints");
				}
				const bootChoice = await promptQuestion(
					this.#modalManager,
					"Select a pair of boots",
					pnts.length === 1 ? "Which boots does this paint belong to?" : "Which boots do these paints belong to?",
					Array.from(bootSet)
				);
				log.info("installPNTs: boot selected", bootChoice);
				const bootsFolder = path.extname(bootChoice) === ".pkz" ? bootChoice.split(".pkz")[0] : bootChoice;
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "boots", bootsFolder, "paints");
				break;

			case "gloves":
				log.info("installPNTs: handling paintType 'gloves'");
				mod.type = "rider";
				const riderChoices = this.#getRiders();
				const riderChoice = await promptQuestion(
					this.#modalManager,
					"Select a rider",
					"Which rider do these gloves belong to?",
					riderChoices
				);
				log.info("installPNTs: rider selected for gloves", riderChoice);
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "riders", riderChoice, "gloves");
				break;

			case "riders":
				log.info("installPNTs: handling paintType 'riders'");
				mod.type = "rider";
				const riderPaintChoices = this.#getRiders();
				const riderPaintChoice = await promptQuestion(
					this.#modalManager,
					"Select a rider",
					pnts.length === 1 ? "Which rider does this paint belong to?" : "Which rider do these paints belong to?",
					riderPaintChoices
				);
				log.info("installPNTs: rider selected for paints", riderPaintChoice);
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "riders", riderPaintChoice, "paints");
				break;

			case "protections":
				log.info("installPNTs: handling paintType 'protections'");
				mod.type = "rider";
				const protections = this.#getProtections();
				const protectionChoice = await promptQuestion(
					this.#modalManager,
					"Select a protection",
					pnts.length === 1 ? "Which protection is this paint for?" : "Which protection are these paints for?",
					protections
				);
				log.info("installPNTs: protection selected", protectionChoice);
				builtPaintsLocation = path.join(
					path.dirname(tmpSrc),
					"mods",
					"rider",
					"protections",
					protectionChoice,
					"paints"
				);
				break;

			default:
				log.warn("installPNTs: no valid paint type selected, skipping PNT installation");
				return;
		}

		log.info("installPNTs: builtPaintsLocation set to", builtPaintsLocation);
		for (const pnt of pnts) {
			log.info("installPNTs: copying pnt file", pnt, "to", builtPaintsLocation);
			await cpRecurse(pnt, builtPaintsLocation);
		}
		log.info("installPNTs: completed for mod", mod.name);
	}

	async #installPKZs(mod: Mod, tmpSrc: string) {
		log.info("installPKZs: starting for mod", mod.name);
		const pkzs = findFilesByType(tmpSrc, "pkz");
		log.info("installPKZs: found pkz files", pkzs);

		let pkzType: string;
		if (pkzs?.length) {
			log.info("installPKZs: prompting for pkz type");
			pkzType = await promptQuestion(this.#modalManager, "Select mod type", `What type of mod is ${mod.name}?`, [
				"helmets",
				"boots",
				"bikes",
				"tracks",
				"tyres",
				"protections",
				"helmet addon",
			]);
			log.info("installPKZs: pkzType selected", pkzType);
		}

		let builtPkzsLocation: string;
		switch (pkzType) {
			case "helmets":
				log.info("installPKZs: handling pkzType 'helmets'");
				mod.type = "rider";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets");
				break;
			case "boots":
				log.info("installPKZs: handling pkzType 'boots'");
				mod.type = "rider";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "boots");
				break;
			case "riders":
				log.info("installPKZs: handling pkzType 'riders'");
				mod.type = "rider";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "riders");
				break;
			case "tracks":
				log.info("installPKZs: handling pkzType 'tracks'");
				mod.type = "track";
				const trackFolder = await this.#selectTrackFolder(mod.name);
				log.info("installPKZs: track folder determined", trackFolder);
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "tracks", trackFolder);
				break;
			case "bikes":
				log.info("installPKZs: handling pkzType 'bikes'");
				mod.type = "bike";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "bikes");
				break;
			case "tyres":
				log.info("installPKZs: handling pkzType 'tyres'");
				mod.type = "bike";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "tyres");
				break;
			case "protections":
				log.info("installPKZs: handling pkzType 'protections'");
				mod.type = "other";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "protections");
				break;
			case "helmet addon":
				log.info("installPKZs: handling pkzType 'helmet addon'");
				mod.type = "rider";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmetcams");
				break;
			default:
				log.warn("installPKZs: no valid pkz type selected, skipping PKZ installation");
				return;
		}

		log.info("installPKZs: builtPkzsLocation set to", builtPkzsLocation);
		for (const pkz of pkzs) {
			log.info("installPKZs: copying pkz file", pkz, "to", builtPkzsLocation);
			await cpRecurse(pkz, builtPkzsLocation);
		}
		log.info("installPKZs: completed for mod", mod.name);
	}

	async #selectTrackFolder(trackName: string): Promise<string | null> {
		log.info("selectTrackType: prompting for track type for", trackName);
		const trackFolders: string[] = [...this.#getTrackFolders(), "Create New"];
		let trackFolder = await promptQuestion(
			this.#modalManager,
			"Select Track Type",
			`What kind of track is ${trackName}?`,
			trackFolders
		);
		log.info("selectTrackType: selected track folder", trackFolder);

		if (trackFolder === "create new") {
			trackFolder = await this.#modalManager.promptText(
				mainWindow,
				"Create new track folder",
				"Enter a name for the new track folder"
			);
			console.log("Response from selecting track folder: ", trackFolder);
		}

		return trackFolder;
	}

	#getModTypeFromModsSubdir(source: string): ModType {
		if (!fs.statSync(source).isDirectory()) return null;
		const subfolders = fs.readdirSync(source);

		for (const f of subfolders) {
			switch (f.toLowerCase()) {
				case "bikes":
					return "bike";
				case "tracks":
					return "track";
				case "rider":
					return "rider";
			}
		}

		return "other";
	}
}

export default ModInstaller;
