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
	const ft = path.extname(source);
	switch (ft) {
		case ".zip":
			return await subdirExistsZip(source, target);
		case ".rar":
			return await subdirExistsRar(source, target);
	}

	let entries;
	try {
		entries = fs.readdirSync(source);
	} catch (err) {
		// must not be a file
		console.error("Source is a file or does not exist");
		return null;
	}

	console.log("Checking entries: ", entries);

	for (const entry of entries) {
		const fullPath = path.join(source, entry);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			console.log("Found subdirectory: ", fullPath);
			console.log("Comparing ", entry, " to ", target);
			if (entry.toLowerCase() === target.toLowerCase()) {
				return fullPath;
			}

			const result = await subdirExists(fullPath, target);
			if (result) return result;
		}
	}

	return null;
}

async function subdirExistsRar(
	source: string,
	target: string // e.g. "mods"
): Promise<string | null> {
	return new Promise((resolve, reject) => {
		const rarPath =
			process.env.NODE_ENV === "development"
				? path.join(__dirname, "resources", "bin", "rar.exe")
				: path.join(process.resourcesPath, "bin", "rar.exe");

		// 1) call `rar l` with *no* mask to list every entry
		const child = spawn(rarPath, ["l", source]);

		let output = "",
			err = "";
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (c) => (output += c));
		child.stderr.setEncoding("utf8");
		child.stderr.on("data", (c) => (err += c));

		child.on("error", reject);
		child.on("close", (code) => {
			// console.log("output: ", output);
			// console.log("err: ", err);
			if (code !== 0) {
				return reject(new Error(`RAR failed (${code}): ${err}`));
			}

			// strip the first 3 lines (banner + headers) and the trailing summary
			const lines = output
				.split(/\r?\n/)
				.slice(3)
				.filter((l) => !!l.trim() && !/^\s*\d+\s+files?/.test(l))
				.map((l) => {
					const parts = l.trim().split(/\s+/);
					return parts.slice(4).join(" ");
				});

			// find the first entry containing target
			for (const name of lines) {
				console.log("name: ", name);
				const idx = name.indexOf(`${target}`);
				if (idx !== -1) {
					// return up to and including target
					return resolve(name.substring(0, idx + target.length));
				}
			}

			resolve(null);
		});
	});
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
		// If source is a relative path, statSync won't be able to find it.
		// In this case, fall back to checking the extname
		const ft = path.extname(source);
		if (ft === "") return true;
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
