import path from "path";
import fs from "fs";
import FolderStructure from "../models/FolderStructure";
import { FolderEntries } from "src/types";
import { isDir } from "../utils/FileSystemUtils";

class FolderStructureBuilder {
	// this funcion should....
	// take in a location where the mod exists WITH a mods folder ALWAYS
	// so `location`/mods ALWAYS EXISTS
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
			if (isDir(entryPath)) {
				root.subfolders[e.toLowerCase()] = this.buildEntries(entryPath);
			} else {
				root.files.push(e);
			}
		}

		return root;
	}
}

export default FolderStructureBuilder;
