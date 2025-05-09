import fs from "fs";
import path from "path";
import FolderStructure from "../models/FolderStructure";
import { FolderEntries } from "src/types";

import log from "electron-log/main";

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

export class FolderStructureDeleter {
	static delete(structure: FolderStructure, currentDirectory: string): void {
		log.info("Deleting: ", structure);
		log.info("From current directory: ", currentDirectory);
		let entries;
		try {
			entries = structure.getEntries();
		} catch (err) {
			// wrong data type, assume it's a folder entries ig...
			entries = structure as unknown as FolderEntries;
		}

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
			this.delete(substruct, subdirPath);
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

export default FolderStructureDeleter;
