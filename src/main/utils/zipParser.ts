import yauzl from "yauzl";
import { FolderStructure, Mod } from "../../types/types";
import path from "path";

function getModName(filePath: string) {
	return path.basename(filePath, path.extname(filePath));
}

async function parseZipFile(zipPath: string): Promise<FolderStructure> {
	return new Promise((resolve, reject) => {
		const modName = getModName(zipPath);

		const root: FolderStructure = {
			files: [],
			subfolders: {},
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

function addPathToFolderStructure(
	root: FolderStructure,
	path: string,
	isDir: boolean
) {
	if (isDir) {
		addDirToFolderStructure(root, path);
	} else {
		addFileToFolderStructure(root, path);
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

/**
 * Returns the path of target relative to zipPath if found, else null
 * Ex. target = mods, zipPath = C:/Downloads/foo.zip, and foo.zip contains subfolder bar/mods, mods location relative to zipPath is bar/mods
 */
function subdirExistsZip(
	zipPath: string,
	target: string
): Promise<string | null> {
	return new Promise((resolve, reject) => {
		yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
			if (err || !zipfile) return reject(err);

			zipfile.readEntry();

			zipfile.on("entry", (entry) => {
				// Check if it's a directory exactly named target
				const entryName = path.basename(entry.fileName);
				console.log("Current entry name: ", entryName);
				if (entryName === target) {
					console.log("Found mods subdir");
					zipfile.close(); // stop reading more entries
					return resolve(entry.fileName);
				}

				zipfile.readEntry();
			});

			zipfile.on("end", () => {
				resolve(null);
			});

			zipfile.on("error", reject);
		});
	});
}

export { parseZipFile, subdirExistsZip };
