import yauzl from "yauzl";
import { FolderStructure } from "../../types/types";

async function parseZipFile(zipPath: string): Promise<FolderStructure> {
	return new Promise((resolve, reject) => {
		const root: FolderStructure = { files: [], subfolders: {} };

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
	console.log("Adding file to folder structure: ", filePath);
	const paths = filePath.split("/");
	let current = root;
	for (let i = 0; i < paths.length - 1; ++i) {
		current = current.subfolders[paths[i]];
	}
	current.files.push(paths[paths.length - 1]);
}

export { parseZipFile };
