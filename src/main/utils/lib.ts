import fs from "fs";
import path from "path";
import { subdirExistsZip } from "./zipParser";
import { ModType } from "src/types/types";

/**
 * Recursively searches for a subdirectory, and returns the location if it exists, else null
 */
export async function subdirExists(
	source: string,
	target: string
): Promise<string | null> {
	if (path.extname(source) === ".zip") {
		return await subdirExistsZip(source, target);
	}
	const entries = fs.readdirSync(source);

	for (const entry of entries) {
		const fullPath = path.join(source, entry);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			if (entry === target) {
				return fullPath;
			}

			const result = subdirExists(fullPath, target);
			if (result) return result;
		}
	}

	return null;
}

export function getModTypeFromModsSubdir(source: string): ModType {
	// If this mod contained a mods subfolder, that means that we can
	// get a lot of information from its directory structure.
	// The mod type can be found by checking what subdirectory is under the mods subfolder
	// Ex. mods->bikes === bike mod, mods->tracks === track mod, mods->rider === rider mod
	const subfolders = fs.readdirSync(source);
	for (const f of subfolders) {
		switch (f) {
			case "bikes":
				return "bike";
			case "tracks":
				return "track";
			case "rider":
				return "rider";
			default:
				return "other";
		}
	}
}

export function isDir(source: string): boolean {
	try {
		return fs.statSync(source).isDirectory();
	} catch (err) {
		console.error(err);
		return false;
	}
}
