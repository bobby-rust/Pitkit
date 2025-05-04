import fs from "fs";
import { ModType } from "src/types";
import { isDir } from "../utils/FileSystemUtils";

export function getModTypeFromModsSubdir(source: string): ModType {
	if (!isDir(source)) return null;
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
