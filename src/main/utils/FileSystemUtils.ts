import fs from "fs";
import path from "path";
import log from "electron-log/main";

/**
 * Copies a file from source to dest. Will create the directory recursively
 * if it does not exist.
 *
 * @param source The path of the file
 * @param dest The path of the directory the file will be copied to, will be created if it does not exist
 */
async function cpRecurse(source: string, dest: string) {
	if (!fs.existsSync(dest)) {
		log.info("Directory does not exist, creating directory:", dest);
		fs.mkdirSync(dest, { recursive: true });
	}

	log.info("Copying " + source + " to dest: ", dest);

	const fileName = path.basename(source);
	const destFile = path.join(dest, fileName);
	await fs.promises
		.cp(source, destFile, { recursive: true })
		.catch((err) => log.error("cpRecurse: Error copying file: ", err));
}

/**
 * Given a file name WITH an extension, returns an array of absolute paths
 * to the directories containing fileName
 *
 * Used to find important files that reveal the type of mod
 */
function findDirectoriesContainingFileName(source: string, fileName: string) {
	log.info("Finding " + fileName + " in ", source);
	const dirs: string[] = [];
	let folderEntries;
	try {
		folderEntries = fs.readdirSync(source);
	} catch (e) {
		log.error(e);
		return [];
	}
	log.info(folderEntries);

	for (const entry of folderEntries) {
		const subfolderPath = path.join(source, entry);

		log.info("Comparing ", entry, " to ", fileName);
		if (entry === fileName) {
			log.info("Found " + fileName + " in ", subfolderPath);
			dirs.push(source);
		} else if (fs.statSync(subfolderPath).isDirectory()) {
			log.info("Found subdirectory...", entry);
			const result = findDirectoriesContainingFileName(subfolderPath, fileName);
			dirs.push(...result);
		}
	}

	return dirs;
}

/**
 * Given a source location and a file type, returns an array of
 * absolute paths to all files of type ft, except the ones present in
 * excluded directories
 */
function findFilesByType(source: string, ft: string, excludeDirs?: string[]): string[] {
	if (excludeDirs?.includes(source)) return [];
	// Prepend the dot to the file type if it does not exist
	if (!(ft[0] === ".")) ft = "." + ft;

	log.info("Finding files of type " + ft + " in ", source);
	if (!fs.statSync(source).isDirectory()) {
		return [];
	}

	const files: string[] = [];
	let entries: string[];
	try {
		entries = fs.readdirSync(source);
	} catch (err) {
		log.error(err);
		return [];
	}

	entries.forEach((entry) => {
		const fullPath = path.join(source, entry);
		if (fs.statSync(fullPath).isDirectory()) {
			files.push(...findFilesByType(fullPath, ft, excludeDirs));
		} else {
			const entryFt = path.extname(entry);
			if (entryFt === ft) {
				files.push(fullPath);
			}
			// Maybe check for more compressed files here cause ya never know with these ppl
			// im just too lazy to do that rn
		}
	});

	return files;
}

function findSubdir(source: string, target: string): string | null {
	let entries;
	try {
		entries = fs.readdirSync(source);
	} catch (err) {
		// must not be a file
		log.error("Source is a file or does not exist");
		return null;
	}

	log.info("Checking entries: ", entries);

	for (const entry of entries) {
		const fullPath = path.join(source, entry);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			log.info("Found subdirectory: ", fullPath);
			log.info("Comparing ", entry, " to ", target);
			if (entry.toLowerCase() === target.toLowerCase()) {
				return fullPath;
			}

			const result = this.subdirExists(fullPath, target);
			if (result) return result;
		}
	}

	return null;
}

function findDeepestSubdir(source: string, target: string): string | null {
	let deepestPath: string | null = null;
	let maxDepth = -1;

	function helper(dir: string, depth: number) {
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			// not a directory or doesn’t exist
			return;
		}

		for (const entry of entries) {
			const fullPath = path.join(dir, entry);
			let stat: fs.Stats;
			try {
				stat = fs.statSync(fullPath);
			} catch {
				continue;
			}

			if (!stat.isDirectory()) continue;

			// if this folder matches, check if it's deeper than what we've seen
			if (entry.toLowerCase() === target.toLowerCase()) {
				if (depth > maxDepth) {
					maxDepth = depth;
					deepestPath = fullPath;
				}
			}

			// keep recursing deeper
			helper(fullPath, depth + 1);
		}
	}

	helper(source, 0);
	return deepestPath;
}

export { cpRecurse, findDirectoriesContainingFileName, findFilesByType, findSubdir, findDeepestSubdir };
