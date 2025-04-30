import fs from "fs";
import path from "path";
import { subdirExistsZip } from "./zipParser";
import { ModType } from "src/types/types";
import { spawn } from "child_process";

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

	let entries;
	try {
		entries = fs.readdirSync(source);
	} catch (err) {
		// must not be a file
		return null;
	}

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
	if (!isDir(source)) return null;
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
		return false;
	}
}

export async function extractRar(rarPath: string, extractPath: string) {
	await fs.promises.mkdir(extractPath, { recursive: true });
	// Path to bundled unrar.exe
	const unrarPath =
		process.env.NODE_ENV === "development"
			? path.join(__dirname, "resources", "bin", "unrar.exe") // Development
			: path.join(process.resourcesPath, "bin", "unrar.exe"); // Production

	return new Promise((resolve, reject) => {
		const unrarProcess = spawn(unrarPath, [
			"x", // Extract with full paths
			"-o+", // Overwrite existing files
			"-y", // Yes to all queries
			rarPath, // Path to RAR file
			extractPath,
		]);

		unrarProcess.on("close", (code) => {
			if (code === 0) {
				resolve(true);
			} else {
				reject(new Error(`Extraction failed with code ${code}`));
			}
		});

		unrarProcess.on("error", (err) => {
			reject(err);
		});
	});
}
