import { FolderEntries } from "src/types";
import log from "electron-log/main";
import fs from "fs";
import path from "path";

const WHITELISTED_DIRS: Set<string> = new Set([
	"bikes",
	"tracks",
	"rider",
	"tyres",
	"misc",
	"fonts",
	"pitboard",
	"animations",
	"boots",
	"helmetcams",
	"helmets",
	"protections",
	"riders",
	"default_mx",
	"enduro",
	"motocross",
	"supercross",
	"supermoto",
]);

export class FolderStructure {
	private entries: FolderEntries;

	constructor(entries: FolderEntries = { files: [], subfolders: {} }) {
		this.entries = entries;
	}

	public getEntries(): FolderEntries {
		return this.entries;
	}

	public setEntries(entries: FolderEntries): void {
		this.entries = entries;
	}

	public toJSON(): FolderEntries {
		return this.entries;
	}

	// take in a location where the mod exists WITH a mods folder ALWAYS
	// so mods/`location` ALWAYS EXISTS
	// And location is ONLY THE MOD, NOT THE MOD IN THE MODSFOLDER,
	// So if a mod with a mods subfolder was installed, from a folder, we pass the location of that folder,
	// not the location of the installed mod.
	// If the mod was installed from a zip, we extract the zip to tmpdir, then pass the location of the mod in tmpdir WITH A MODS SUBFOLDER.
	static build(location: string): FolderStructure {
		const structure = new FolderStructure();
		const entries = this.buildEntries(location);
		structure.setEntries(entries);
		return structure;
	}

	private static buildEntries(location: string): FolderEntries {
		// So we have an absolute path to a folder
		// So we need to start in that folder and add all directories to subfolders
		// and add all files to files
		const root: FolderEntries = {
			files: [],
			subfolders: {},
		};

		const currentEntries = fs.readdirSync(location);
		for (const e of currentEntries) {
			const entryPath = path.join(location, e);
			if (fs.statSync(entryPath).isDirectory()) {
				root.subfolders[e.toLowerCase()] = this.buildEntries(entryPath);
			} else {
				root.files.push(e);
			}
		}

		return root;
	}

	delete(currentDirectory: string): void {
		log.info("deleting from current directory: ", currentDirectory);

		const entries = this.getEntries();
		for (const file of entries.files) {
			try {
				fs.rmSync(path.join(currentDirectory, file), {
					recursive: true,
				});
			} catch (err) {
				log.error(err);
			}
		}

		for (const [k, v] of Object.entries(entries.subfolders)) {
			const subdirPath = path.join(currentDirectory, k);
			const substruct = new FolderStructure();
			substruct.setEntries(v);
			substruct.delete(subdirPath);
		}

		try {
			const isDirectoryEmpty: boolean = fs.readdirSync(currentDirectory).length === 0;
			const basename = path.basename(currentDirectory);
			const isWhitelisted = WHITELISTED_DIRS.has(basename);
			if (isDirectoryEmpty && !isWhitelisted) {
				fs.rmSync(currentDirectory, { recursive: true });
			}
		} catch (err) {
			log.error(err);
		}
	}
}

export default FolderStructure;
