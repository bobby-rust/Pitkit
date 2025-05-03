import path from "path";
import fs from "fs";
import yauzl from "yauzl";

import PitkitLib from "./pitkitLib";
import { FolderEntries } from "src/types";

const WHITELISTED_DIRS: Set<string> = new Set([
	"bikes",
	"tracks",
	"rider",
	"tyres",
	"misc",
	"fonts",
	"pitboard",
	"animations",
	"boots",
	"fonts",
	"helmetcams",
	"helmets",
	"protections",
	"riders",
	"default_mx",
	"enduro",
	"motocross",
	"supercross",
	"supermoto",
]);

class FolderStructure {
	public entries: FolderEntries;
	private modsFolder: string;
	private pitkitLib: PitkitLib;

	constructor(modsFolder: string) {
		this.pitkitLib = new PitkitLib();
		this.modsFolder = modsFolder;
	}

	public getModsFolder() {
		return this.modsFolder;
	}
	public setModsFolder(modsFolder: string) {
		this.modsFolder = modsFolder;
	}

	// source should actually be an absolute path to the source folder...
	// if we get passed a rar, extract it to a temp dir, then build the folder structure from the temp dir
	// same if we get passed a zip
	// If we get passed a folder, no need to build the folder structure from the temp dir, we can just build it from source path.
	public async setEntries(source: string) {
		// but if not... i need more information... like where the source is installed at.
		// So if there's no mods subdir, then source will be just a folder that we don't know where it was installed to...
		// So if we get passed a source with no mods subfolder, what do we do ?
		// we'll need relative dirs from the mods folder up to source.
		// So for example if source is Skull and it's installed in mods/rider/helmets/Skull,
		// we'll get passed C:/Users/Downloads/Skull, and we'll need "mods/rider/helmets",
		// that is all the data that we need because it is impossible for the mod to contain any
		// other files or subfolders other than the ones listed in relative dirs
		// BUT if source is Skull/mods/rider/helmets/Skull, all that data is already there.
		// Maybe we should ALWAYS pass source as relative to mods, so we will build up relative dirs during the install process, then set the entries at the end.
		// BUT we have to make sure not to build the mod from the modsFolder as it could contain other files not relevant to the mod, we have to build the mod using ONLY
		// the files from the source. So... we should build the entries from os.tmpdir/PitkitExtract/mods/rider/helmets/Skull, but that means we'd have to build up our own
		// mods directory before extracting, which will not work with our current setup
	}

	public async setEntriesFromZip(source: string) {
		this.entries = await this.parseZipFile(source);
	}

	// Folder should be relative to modsFolder
	public setEntriesFromFolder(relativeDir: string): FolderEntries {
		console.log("Got relative dir: ", relativeDir);
		return this.buildFolderStructFromDir(relativeDir);
	}

	/** PRIVATE **/

	// Adds the directories after mods up to the final directory
	// dir is relative to modsFolder
	private addRelativeDirsToFolderStruct(
		root: FolderEntries,
		relativeDir: string
	) {
		const relativeDirArr = relativeDir.split("\\");

		let current = root.subfolders;
		for (const dir of relativeDirArr) {
			console.log("Adding dir to subfolders: ", dir);
			current[dir] = {
				files: [],
				subfolders: {},
			};
			current = current[dir].subfolders;
		}
	}

	// Recursively add dir and all of its subfolders to a folder structure
	private addDirToFolderStruct(root: FolderEntries, dir: string) {
		// If dir contains file, place them into root.files
		// If dir contains a dir, place them into root.subfolders,
		// Then call recursively on the dir.
		const entries = fs.readdirSync(dir);
		for (const entry of entries) {
			const cwd = path.join(dir, entry);
			if (this.pitkitLib.isDir(cwd)) {
				root.subfolders[entry] = { files: [], subfolders: {} };
				this.addDirToFolderStruct(root.subfolders[entry], cwd);
			} else {
				root.files.push(entry);
			}
		}
	}

	private buildFolderStructFromDir(dir: string) {
		const root: FolderEntries = {
			files: [],
			subfolders: {},
		};

		// After the mods folder and up until the directory passed to the func, only the dirs should be added
		this.addRelativeDirsToFolderStruct(root, dir);

		const relativeDirArr = dir.split("\\");
		let current = root;
		for (const dir of relativeDirArr) {
			current = current.subfolders[dir];
		}

		this.addDirToFolderStruct(current, path.join(this.modsFolder, dir));

		console.log("Built root: ", root);
		return root;
	}

	private async parseZipFile(zipPath: string): Promise<FolderEntries> {
		return new Promise((resolve, reject) => {
			const root: FolderEntries = {
				files: [],
				subfolders: {},
			};

			yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
				if (err || !zipfile)
					return reject(err || new Error("Failed to parse zip file"));

				zipfile.readEntry();

				// yauzl readEntry does not guarantee that nested paths will not be evaluated before their parent.
				// Thus, we cannot assume that a directory exists when adding a file to a FolderStructure
				zipfile.on("entry", (entry) => {
					// The third argument determines whether the entry is a folder or a file
					this.addPathToFolderEntries(root, entry.fileName);

					zipfile.readEntry();
				});

				zipfile.once("end", () => resolve(root));
			});
		});
	}

	private addPathToFolderEntries(root: FolderEntries, path: string) {
		console.log("Adding path to folder structure: ", path);
		const isDirectory = this.pitkitLib.isDir(path);
		if (isDirectory) {
			console.log("Path is dir: ", path);
			this.addDirToFolderStructure(root, path);
		} else {
			console.log("Path is not dir: ", path);
			this.addFileToFolderStructure(root, path);
		}
	}

	/**
	 * Add directory to folder structure
	 *
	 * @param root The root of the folder structure
	 * @param dir the directory to add to the root
	 */
	private addDirToFolderStructure(root: FolderEntries, dir: string) {
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

	private addFileToFolderStructure(root: FolderEntries, filePath: string) {
		if (!root) return;
		const paths = filePath.split("/");

		// If the last element is an empty string, remove it
		if (paths[paths.length - 1] === "") paths.pop();

		let current = root;
		for (let i = 0; i < paths.length - 1; ++i) {
			if (!paths[i] || paths[i] === "mods") continue;

			let tmp = current.subfolders[paths[i]];

			if (!tmp) {
				this.addDirToFolderStructure(root, filePath);
				tmp = current.subfolders[paths[i]];
			}
			current = tmp;
		}
		current.files.push(paths[paths.length - 1]);
	}

	/**
	 * Recursively delete all files from a FolderStructure.
	 * If folders are empty after deleting all files, those folders will also be deleted.
	 *
	 */
	public delete(currentDirectory: string) {
		// For each file in current directory
		for (const file of this.entries.files) {
			try {
				// rm the file
				fs.rmSync(path.join(currentDirectory, file), {
					recursive: true,
				});
			} catch (err) {
				// error, continue anyways to delete the rest
				console.error(err);
			}
		}

		// Check subfolders before checking to delete the current folder
		// For each subfolder name and FolderStructure associated with it
		for (const [k, v] of Object.entries(this.entries.subfolders)) {
			// The current directory is the current directory plus the name of the current subfolder
			currentDirectory = path.join(currentDirectory, k);
			this.delete(currentDirectory);
			// Reset the current directory because there may be other folders in the current directory that need to be deleted
			currentDirectory = path.dirname(currentDirectory);
		}

		// Now all subfolders of the current folder have been checked, see if the current folder needs to be deleted
		try {
			// If the folder is empty AND it is not a whitelisted folder (folders that the base game creates in the mods directory), delete it
			const isDirectoryEmpty =
				this.pitkitLib.isDirEmpty(currentDirectory);
			const basename = path.basename(currentDirectory);
			const isWhitelisted = WHITELISTED_DIRS.has(basename);
			if (isDirectoryEmpty && !isWhitelisted) {
				fs.rmSync(currentDirectory, { recursive: true });
			}
		} catch (err) {
			console.error(err);
		}
	}
}

export default FolderStructure;
