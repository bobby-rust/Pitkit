import Decompressor from "./Decompressor";
import path from "path";
import os from "os";
import fs from "fs";
import { Mod, TrackType } from "../../types/";
import { cpRecurse, findDirectoriesContainingFileName, findFilesByType, findDeepestSubdir } from "../utils/FileSystemUtils";
import { promptQuestion } from "../utils/dialogHelper";
import FolderStructureBuilder from "../services/FolderStructureBuilder";
import { getModTypeFromModsSubdir } from "../services/ModClassifier";
import FolderStructureDeleter from "../services/FolderStructureDeleter";

/**
 * TODO:
 * [ ] - Recursive extraction
 * [ ] - Extract files with passwords
 * [ ] - helmet cameras can be either pkz or <any string>.edf, so now we need to handle unrecognized edfs
 * [ ] - Install fonts
 * [ ] - Install stands
 * [ ] - Install rider animations
 * [ ] - Install modpacks
 * [ ] - Install menu backgrounds
 * [ ] - Install MaxHUD
 * [ ] - Install Reshade presets
 * [ ] - Install UI mods
 * [ ] - Install translations
 * [ ] - Custom mod name
 * [ ] - Custom track folder
 */
class ModInstallerV2 {
	private modsFolder: string;
	private tmpDir: string;
	private decompressor: Decompressor;

	constructor(modsFolder: string, sendProgress: (progress: number) => void) {
		this.modsFolder = modsFolder;
		this.tmpDir =
			process.env.NODE_ENV === "development" ? path.join(__dirname, "tmp") : path.join(os.tmpdir(), "PitkitExtract");

		console.log("Temp dir: ", this.tmpDir);
		this.decompressor = new Decompressor(sendProgress);
	}

	public setModsFolder(modsFolder: string) {
		this.modsFolder = modsFolder;
	}

	async uninstall(mod: Mod) {
		FolderStructureDeleter.delete(mod.files, this.modsFolder);
	}

	async install(source: string) {
		console.log("Installing ", source);
		const mod: Mod = Mod.from(source);

		// look for something that gives away the mod type:
		// helmet.edf, rider.edf, boots.edf

		// We begin to build the tmp folder containing a mods subdir.
		// The strategy for mod installation is to build a folder containing a mods subdir
		// that can simply be copied over to modsFolder.
		let tmpSrc: string = path.join(this.tmpDir, mod.name);
		if (!fs.statSync(source).isDirectory()) {
			const ft = path.extname(source);
			switch (ft) {
				case ".zip":
				case ".rar":
					try {
						await this.decompressor.extract(source, tmpSrc);
					} catch (err) {
						console.error(err);
						throw new Error("Unable to extract password protected ZIP or RAR files.");
					}
					break;
				case ".pnt":
				case ".pkz":
					await cpRecurse(source, tmpSrc);
					break;
				default:
					throw new Error("Unknown file type for mod: '" + ft + "'");
			}
		} else {
			await cpRecurse(source, tmpSrc);
		}
		// So at this point we have a folder in tmpSrc containing the mod, but it could be any type of mod, pkz, anything

		/* =================== Check for mods subdir ===================== */
		const modsSubdirLocation = findDeepestSubdir(tmpSrc, "mods");
		if (modsSubdirLocation) {
			mod.type = getModTypeFromModsSubdir(modsSubdirLocation);
			await cpRecurse(modsSubdirLocation, path.dirname(this.modsFolder));
			const folderStruct = FolderStructureBuilder.build(modsSubdirLocation);
			mod.files = folderStruct;
			return mod;
		}

		/* ============================= Install EDF Models ==================== */

		const bootModels = findDirectoriesContainingFileName(tmpSrc, "boots.edf");
		const riderModels = findDirectoriesContainingFileName(tmpSrc, "rider.edf");
		const helmetModels = findDirectoriesContainingFileName(tmpSrc, "helmet.edf");
		const bikeModels = findDirectoriesContainingFileName(tmpSrc, "model.edf");
		const soundMods = findDirectoriesContainingFileName(tmpSrc, "engine.scl");
		const wheelModels = findDirectoriesContainingFileName(tmpSrc, "p_mx.edf");
		const tyreMods = findFilesByType(tmpSrc, "tyre");
		const protectionModels = findDirectoriesContainingFileName(tmpSrc, "protection.edf");

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
			const bikes = this.getBikes();
			const bike = await promptQuestion(title, message, bikes);
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
			const bikes = this.getBikes();
			const bike = await promptQuestion(title, message, bikes);
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

		/* ===================== Install PNTs =============== */
		await this.installPNTs(mod, tmpSrc, [...bootModels, ...riderModels, ...helmetModels, ...protectionModels]);

		/* ============================ Install PKZs ====================================== */
		await this.installPKZs(mod, tmpSrc);

		/**
		 * Finally, copy temp mods folder to real mods folder and built the FolderStructure
		 */
		const tmpModsLocation = path.join(path.dirname(tmpSrc), "mods");
		await cpRecurse(tmpModsLocation, path.dirname(this.modsFolder));

		const folderStruct = FolderStructureBuilder.build(tmpModsLocation);
		mod.files = folderStruct;

		try {
			fs.rmSync(this.tmpDir, { recursive: true });
		} catch (err) {
			console.error(err);
		}

		return mod;
	}

	/* ============================== Get Available Mods By Type =========================== */
	private getBikes(): string[] {
		const bikesDir = path.join(this.modsFolder, "bikes");
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

	private getHelmets(): Set<string> {
		const helmetsDir = path.join(this.modsFolder, "rider", "helmets");
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

	private getBoots(): Set<string> {
		const bootsDir = path.join(this.modsFolder, "rider", "boots");
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
	private getRiders(): string[] {
		const ridersDir = path.join(this.modsFolder, "rider", "riders");
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

	private getProtections(): string[] {
		const protectionsDir = path.join(this.modsFolder, "rider", "protections");
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

	// Installs pnts to tmp with the mods subdir structure, still needs to be copied over to modsFolder after.
	private async installPNTs(mod: Mod, tmpSrc: string, excludeDirs: string[]) {
		// Now we can try to find paints, but exclude the directories containing the models...
		const pnts = findFilesByType(tmpSrc, "pnt", [...excludeDirs]);
		console.log("Got pnt files: ", pnts);

		// So now for pnts and pkzs, we need to determine what type and where they go
		let paintType: string;
		if (pnts?.length) {
			const title = "Select paint type";
			const message = "What type of paints are you installing?";
			const buttons = ["helmets", "goggles", "boots", "gloves", "riders", "bikes", "protections"];
			paintType = await promptQuestion(title, message, buttons);
		}

		// For now, we are installing all pnts in the same location, and all pkzs in the same location.
		// To make this more flexible, we could prompt for each individual pnt and pkz, but that makes a pretty bad user xp.
		// Not sure what to do about that, if anything, so for now this is fine.

		// dirname of tmpSrc because we want to go up 1 directory so that we are in mods/, because tmpSrc is mods/<mod.name>
		let builtPaintsLocation: string;
		let title: string, message: string;
		let rider: string, riders: string[];
		let helmet: string, helmets: Set<string>, helmetFolder: string;
		switch (paintType) {
			case "bikes":
				mod.type = "bike";
				// Find what bike the paint belongs to
				title = "Select a bike";
				message = pnts.length === 1 ? "What bike does this paint belong to?" : "What bike do these paints belong to?";
				const bikes = this.getBikes();

				if (!bikes.length) {
					throw new Error("Unable to install bike paints, no available bikes to install into");
				}

				const bike = await promptQuestion(title, message, bikes);

				// Bike will be a pkz file, so it has the pkz extension, which we need to remove to get to the paints folder.
				const bikeFolder = bike.split(".pkz")[0];
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "bikes", bikeFolder, "paints");
				break;
			// Boots and helmets can be pkzs, so check for that
			case "helmets":
				mod.type = "rider";
				title = "Select a helmet";
				message =
					pnts.length === 1 ? "Which helmet does this paint belong to?" : "What helmets do these paints belong to?";
				helmets = this.getHelmets();
				if (!helmets.size) {
					throw new Error("No helmets installed, unable to install helmet paints");
				}
				helmet = await promptQuestion(title, message, Array.from(helmets));

				if (path.extname(helmet) === ".pkz") {
					helmetFolder = helmet.split(".pkz")[0];
				} else {
					helmetFolder = helmet;
				}

				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets", helmetFolder, "paints");
				break;

			case "goggles":
				mod.type = "rider";
				title = "Select a helmet";
				message =
					pnts.length === 1 ? "Which helmet are these goggles for?" : "What helmet is this pair of goggles for?";
				helmets = this.getHelmets();
				if (!helmets.size) {
					throw new Error("No helmets installed, unable to install goggles");
				}
				helmet = await promptQuestion(title, message, Array.from(helmets));

				if (path.extname(helmet) === ".pkz") {
					helmetFolder = helmet.split(".pkz")[0];
				} else {
					helmetFolder = helmet;
				}

				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets", helmetFolder, "goggles");
				break;
			case "boots":
				mod.type = "rider";
				title = "Select a pair of boots";
				message =
					pnts.length === 1 ? "Which boots does this paint belong to?" : "Which boots do these paints belong to?";
				const boots = this.getBoots();
				console.log("Got boots: ", boots);

				if (!boots.size) {
					throw new Error("No boots installed, unable to install boot paints");
				}

				const boot = await promptQuestion(title, message, Array.from(boots));

				let bootsFolder: string;
				if (path.extname(boot) === ".pkz") {
					bootsFolder = boot.split(".pkz")[0];
				} else {
					bootsFolder = boot;
				}

				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "boots", bootsFolder, "paints");
				break;
			case "gloves":
				mod.type = "rider";
				title = "Select a rider";
				message = "Which rider do these gloves belong to?";

				riders = this.getRiders();
				rider = await promptQuestion(title, message, riders);

				// getRiders will never return anything but a directory, so no need to check for pkz here
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "riders", rider, "gloves");
				break;
			case "riders":
				mod.type = "rider";
				title = "Select a rider";
				message =
					pnts.length === 1 ? "Which rider does this paint belong to?" : "Which rider do these paints belong to?";

				riders = this.getRiders();
				rider = await promptQuestion(title, message, riders);

				// getRiders will never return anything but a directory, so no need to check for pkz here
				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "riders", rider, "paints");
				break;

			case "protections":
				mod.type = "rider";
				title = "Select a protection";
				message = pnts.length === 1 ? "Which protection is this paint for?" : "Which protection are these paints for?";
				const protections = this.getProtections();
				const protection = await promptQuestion(title, message, protections);

				builtPaintsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "protections", protection, "paints");
				break;
		}

		// Now we can copy all paints to the correct bike.
		for (const pnt of pnts) {
			await cpRecurse(pnt, builtPaintsLocation);
		}
	}

	private async installPKZs(mod: Mod, tmpSrc: string) {
		// Last but not least, we have pkzs, well not last but last for now,
		// in the future we could look for sound mods, other mod types etc...
		const pkzs = findFilesByType(tmpSrc, "pkz");

		// If it's a pkz, it could be any type of mod
		let pkzType: string;
		let builtPkzsLocation: string;
		if (pkzs?.length) {
			const title = "Select mod type";
			const message = "What type of models are you installing?";
			const buttons = ["helmets", "boots", "bikes", "tracks", "tyres", "protections", "helmet addon"];
			pkzType = await promptQuestion(title, message, buttons);
		}

		switch (pkzType) {
			case "helmets":
				mod.type = "rider";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmets");
				break;
			case "boots":
				mod.type = "rider";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "boots");
				break;
			case "riders":
				mod.type = "rider";
				// i actually don't think riders can come in pkzs, but if I'm wrong this can be changed
				break;
			case "tracks":
				mod.type = "track";
				mod.trackType = await this.selectTrackType(mod.name);
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "tracks", mod.trackType);
				break;
			case "bikes":
				mod.type = "bike";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "bikes");
				break;
			case "tyres":
				mod.type = "bike";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "tyres");
				break;
			case "protections":
				mod.type = "other";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "protections");
				break;
			case "helmet addon":
				mod.type = "rider";
				builtPkzsLocation = path.join(path.dirname(tmpSrc), "mods", "rider", "helmetcams");
		}

		for (const pkz of pkzs) {
			await cpRecurse(pkz, builtPkzsLocation);
		}
	}

	private async selectTrackType(trackName: string): Promise<TrackType | null> {
		const trackTypes: TrackType[] = ["supercross", "motocross", "supermoto", "enduro"];
		const title = "Select Track Type";
		const message = `What kind of track is ${trackName}?`;
		const trackType = await promptQuestion(title, message, trackTypes);

		return trackType as TrackType;
	}
}

export default ModInstallerV2;
