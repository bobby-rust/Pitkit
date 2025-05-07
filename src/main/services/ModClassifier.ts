import fs from "fs";
import { ModType } from "src/types";

export function getModTypeFromModsSubdir(source: string): ModType {
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
