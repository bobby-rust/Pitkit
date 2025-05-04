import fs from "fs";
import path from "path";
import { isDirEmpty } from "../utils/FileSystemUtils";
import FolderStructure from "../models/FolderStructure";

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
		const entries = structure.getEntries();

		for (const file of entries.files) {
			try {
				fs.rmSync(path.join(currentDirectory, file), {
					recursive: true,
				});
			} catch (err) {
				console.error(err);
			}
		}

		for (const [subdir, substructure] of Object.entries(
			entries.subfolders
		)) {
			const subDirPath = path.join(currentDirectory, subdir);
			// this.delete(
			// 	new FolderStructure(structure.getModsFolder(), substructure),
			// 	subDirPath
			// );
		}

		try {
			const isDirectoryEmpty = isDirEmpty(currentDirectory);
			const basename = path.basename(currentDirectory);
			const isWhitelisted = WHITELISTED_DIRS.has(basename);
			if (isDirectoryEmpty && !isWhitelisted) {
				fs.rmSync(currentDirectory, { recursive: true });
			}
		} catch (err) {
			console.error(err);
		}
	}
}

export default FolderStructureDeleter;
