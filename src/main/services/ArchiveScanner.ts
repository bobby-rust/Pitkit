import { spawn } from "child_process";
import fs from "fs";
import yauzl from "yauzl";
import path from "path";

export class ArchiveScanner {
	async subdirExists(source: string, target: string): Promise<string | null> {
		const ext = path.extname(source);
		switch (ext) {
			case ".zip":
				return this.subdirExistsZip(source, target);
			case ".rar":
				return this.subdirExistsRar(source, target);
			case "":
				return this.subdirExistsFolder(source, target);
			default:
				throw new Error("Unrecognized archive type: " + ext);
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
}
