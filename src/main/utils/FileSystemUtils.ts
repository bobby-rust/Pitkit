import fs from "fs";
import path from "path";

/**
 * Copies a file from source to dest. Will create the directory recursively
 * if it does not exist.
 *
 * @param source The path of the file
 * @param dest The path of the directory the file will be copied to, will be created if it does not exist
 */
async function cpRecurse(source: string, dest: string) {
	if (!fs.existsSync(dest)) {
		console.log("Directory does not exist, creating directory:", dest);
		fs.mkdirSync(dest, { recursive: true });
	}

	console.log("Copying " + source + " to dest: ", dest);

	const fileName = path.basename(source);
	const destFile = path.join(dest, fileName);
	try {
		await fs.promises.cp(source, destFile, { recursive: true }).catch((err) => console.error("Error in cp: ", err));
	} catch (err) {
		console.log("Error in copy func: ", err);
		throw new Error("Unable to install mod: ", err);
	}
}

/**
 * Given a file name WITH an extension, returns an array of absolute paths
 * to the directories containing fileName
 *
 * Used to find important files that reveal the type of mod
 */
function findDirectoriesContainingFileName(source: string, fileName: string) {
	console.log("Finding " + fileName + " in ", source);
	const dirs: string[] = [];
	let folderEntries;
	try {
		folderEntries = fs.readdirSync(source);
	} catch (e) {
		console.error(e);
		return [];
	}
	console.log(folderEntries);

	for (const entry of folderEntries) {
		const subfolderPath = path.join(source, entry);

		console.log("Comparing ", entry, " to ", fileName);
		if (entry === fileName) {
			console.log("Found " + fileName + " in ", subfolderPath);
			dirs.push(source);
		} else if (fs.statSync(subfolderPath).isDirectory()) {
			console.log("Found subdirectory...", entry);
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

	console.log("Finding files of type " + ft + " in ", source);
	if (!fs.statSync(source).isDirectory()) {
		return [];
	}

	const files: string[] = [];
	let entries: string[];
	try {
		entries = fs.readdirSync(source);
	} catch (err) {
		console.error(err);
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
