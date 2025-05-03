import fs from "fs";
import path from "path";

function isDir(source: string): boolean {
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

/**
 * Determines if a directory is empty
 *
 * @param dirname The name of the directory
 * @returns {boolean} Whether the directory is empty
 */
function isDirEmpty(dirname: string): boolean {
	let files;
	try {
		// This will return a list of the names of all files/folders in the directory
		files = fs.readdirSync(dirname);
	} catch (err) {
		console.error(err);
		return false;
	}

	return !files.length;
}

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

	console.log("Copying to dest: ", dest);

	const fileName = path.basename(source);
	const destFile = path.join(dest, fileName);
	try {
		await fs.promises
			.cp(source, destFile, { recursive: true })
			.catch((err) => console.error("Error in cp: ", err));
	} catch (err) {
		console.log("Error in copy func: ", err);
		throw new Error("Unable to install mod: ", err);
	}
}

export { isDir, isDirEmpty, cpRecurse };
