import { spawn } from "child_process";
import fs from "fs";
import yauzl from "yauzl";
import path from "path";

export class ArchiveScanner {
	// async subdirExists(source: string, target: string): Promise<string | null> {
	// 	const ext = path.extname(source);
	// 	switch (ext) {
	// 		case ".zip":
	// 			return this.subdirExistsZip(source, target);
	// 		case ".rar":
	// 			return this.subdirExistsRar(source, target);
	// 		case "":
	// 			return this.subdirExistsFolder(source, target);
	// 		default:
	// 			return null;
	// 	}
	// }

	async subdirExists(source: string, target: string): Promise<string | null> {
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
		target: string // e.g. "mods" or "rider"
	): Promise<string | null> {
		return new Promise((resolve, reject) => {
			const rarPath =
				process.env.NODE_ENV === "development"
					? path.join(__dirname, "resources", "bin", "rar.exe")
					: path.join(process.resourcesPath, "bin", "rar.exe");

			const child = spawn(rarPath, ["l", source]);
			let output = "",
				err = "";

			child.stdout.setEncoding("utf8");
			child.stdout.on("data", (c) => (output += c));
			child.stderr.setEncoding("utf8");
			child.stderr.on("data", (c) => (err += c));

			child.on("error", reject);
			child.on("close", (code) => {
				if (code !== 0) {
					return reject(new Error(`RAR failed (${code}): ${err}`));
				}

				// 1. Grab just the file-list lines
				const lines = output
					.split(/\r?\n/)
					.slice(3) // drop banner + headers
					.filter((l) => l.trim() && !/^\s*\d+\s+files?/.test(l))
					.map((l) => l.trim().split(/\s+/).slice(4).join(" ")); // get the path

				// 2. Scan each file for a path segment === target
				for (const filePath of lines) {
					// split on either slash
					const segments = filePath.split(/[/\\]+/);
					const idx = segments.indexOf(target);
					if (idx !== -1) {
						// 3. build "path/to/target"
						const dirPath = segments.slice(0, idx + 1).join("/");
						return resolve(dirPath);
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
	private subdirExistsZip(zipPath: string, target: string): Promise<string | null> {
		console.log("Checking ", zipPath, " for mods subdir");
		return new Promise((resolve, reject) => {
			yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
				if (err || !zipfile) return reject(err);

				let found = false;

				zipfile.readEntry();

				zipfile.on("entry", (entry) => {
					if (entry.fileName.startsWith(`${target}/`)) {
						found = true;
						zipfile.close(); // stop reading more entries
						return resolve(`${target}/`);
					}

					zipfile.readEntry();
				});

				zipfile.on("end", () => {
					if (!found) resolve(null);
				});

				zipfile.on("error", reject);
			});
		});
	}
}
