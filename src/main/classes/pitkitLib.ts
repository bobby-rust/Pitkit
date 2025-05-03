import fs from "fs";
import path from "path";
import yauzl from "yauzl";

import { ModType } from "src/types";
import { spawn } from "child_process";

class PitkitLib {
	/**
	 * Recursively searches for a subdirectory, and returns the location if it exists, else null
	 */
	public async subdirExists(
		source: string,
		target: string
	): Promise<string | null> {
		const ft = path.extname(source);
		switch (ft) {
			case ".zip":
				return await this.subdirExistsZip(source, target);
			case ".rar":
				return await this.subdirExistsRar(source, target);
			case "":
				return await this.subdirExistsFolder(source, target);
			default:
				throw new Error("Unrecognized file type: '" + ft + "'");
		}
	}

	private async subdirExistsFolder(source: string, target: string) {
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

				const result = await this.subdirExists(fullPath, target);
				if (result) return result;
			}
		}

		return null;
	}

	private async subdirExistsRar(
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

	/**
	 * Returns the path of target relative to zipPath if found, else null
	 * Ex. target = mods, zipPath = C:/Downloads/foo.zip, and foo.zip contains subfolder bar/mods, mods location relative to zipPath is bar/mods
	 */
	private subdirExistsZip(
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
					if (entryName === target) {
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

	public getModTypeFromModsSubdir(source: string): ModType {
		// If this mod contained a mods subfolder, that means that we can
		// get a lot of information from its directory structure.
		// The mod type can be found by checking what subdirectory is under the mods subfolder
		// Ex. mods->bikes === bike mod, mods->tracks === track mod, mods->rider === rider mod
		if (!this.isDir(source)) return null;

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

	public isDir(source: string): boolean {
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
	public isDirEmpty(dirname: string): boolean {
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
	public async cp(source: string, dest: string) {
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
}

export default PitkitLib;
