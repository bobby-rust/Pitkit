import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import unzip from "../utils/unzip";

class Decompressor {
	#sendProgress: (progress: number) => void;

	constructor(sendProgress: (progress: number) => void) {
		this.#sendProgress = sendProgress;
	}

	/**
	 * Extracts a compressed file. Throws an error on failure.
	 * Supports zip and rar files.
	 */
	public async extract(source: string, dest: string) {
		const ft = path.extname(source);
		switch (ft) {
			case ".zip":
				await this.#extractZip(source, dest);
				break;
			case ".rar":
				await this.#extractRar(source, dest);
				break;
			default:
				throw new Error("Unrecognized compression type: '" + ft + "'");
		}
	}

	async #extractRar(rarPath: string, extractPath: string) {
		await fs.promises.mkdir(extractPath, { recursive: true });

		// Path to bundled unrar.exe
		const unrarPath =
			process.env.NODE_ENV === "development"
				? path.join(__dirname, "resources", "bin", "unrar.exe") // Development
				: path.join(process.resourcesPath, "bin", "unrar.exe"); // Production

		return new Promise((resolve, reject) => {
			const unrarProcess = spawn(unrarPath, [
				"x", // Extract with full paths
				"-o+", // Overwrite existing files
				"-y", // Yes to all queries
				rarPath, // Path to RAR file
				extractPath,
			]);

			unrarProcess.on("close", (code) => {
				if (code === 0) {
					resolve(true);
				} else {
					reject(new Error(`Extraction failed with code ${code}`));
				}
			});

			unrarProcess.on("error", (err) => {
				reject(err);
			});
		});
	}

	async #extractZip(source: string, dest: string) {
		await unzip(source, dest, this.#sendProgress);
	}
}

export default Decompressor;
