import yauzl from "yauzl";
import { FolderStructure, Mod } from "../../types/types";
import path from "path";

function getModName(filePath: string) {
	return path.basename(filePath, path.extname(filePath));
}

async function parseZipFile(zipPath: string): Promise<Mod> {
	return new Promise((resolve, reject) => {
		const modName = getModName(zipPath);

		const root: Mod = {
			name: modName,
			files: { files: [], subfolders: {} },
			type: "bike",
			installDate: new Date().toLocaleString(),
		};

		yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
			if (err || !zipfile)
				return reject(err || new Error("Failed to parse zip file"));

			zipfile.readEntry();

			zipfile.on("entry", (entry) => {
				// The third argument determines whether the entry is a folder or a file
				addPathToFolderStructure(
					root,
					entry.fileName,
					entry.fileName.endsWith("/")
				);

				zipfile.readEntry();
			});

			zipfile.once("end", () => resolve(root));
		});
	});
}

function addPathToFolderStructure(root: Mod, path: string, isDir: boolean) {
	if (isDir) {
		addDirToFolderStructure(root.files, path);
	} else {
		addFileToFolderStructure(root.files, path);
	}
}

/**
 * Add directory to folder structure
 *
 * @param root The root of the folder structure
 * @param dir the directory to add to the root
 */
function addDirToFolderStructure(root: FolderStructure, dir: string) {
	const dirs = dir.split("/");
	dirs.pop();
	let current = root;

	for (const subdir of dirs) {
		if (subdir === "mods") continue;
		if (!(subdir in current.subfolders)) {
			current.subfolders[subdir] = {
				files: [],
				subfolders: {},
			};
		}
		current = current.subfolders[subdir]; // Move deeper into the structure
	}
}

function addFileToFolderStructure(root: FolderStructure, filePath: string) {
	const paths = filePath.split("/");
	let current = root;
	for (let i = 0; i < paths.length - 1; ++i) {
		if (paths[i] === "mods") continue;

		current = current.subfolders[paths[i]];
	}
	current.files.push(paths[paths.length - 1]);
}

function zipHasModsSubdir(zipPath: string): Promise<boolean> {
	return new Promise((resolve, reject) => {
		yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
			if (err || !zipfile) return reject(err);

			let found = false;

			zipfile.readEntry();

			zipfile.on("entry", (entry) => {
				// Check if it's a directory exactly named "mods/"
				if (/\/$/.test(entry.fileName) && entry.fileName === "mods/") {
					found = true;
					zipfile.close(); // stop reading more entries
					return resolve(true);
				}

				zipfile.readEntry();
			});

			zipfile.on("end", () => {
				resolve(false);
			});

			zipfile.on("error", reject);
		});
	});
}

export { parseZipFile, zipHasModsSubdir };
