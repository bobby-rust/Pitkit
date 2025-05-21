import fs from "fs";
import path from "path";
import os from "os";
import { cpRecurse } from "../utils/FileSystemUtils";

interface TrainerRecord {
	map: string;
	lapTime: number;
	recordedAt: Date;
	filePath: string;
}

type Records = Record<string, Record<string, string>>;
export default class TrainerService {
	#profilesFolder: string;
	#tmpDir: string;
	constructor(modsFolder: string) {
		this.#profilesFolder = path.join(path.dirname(modsFolder), "profiles");
		this.#tmpDir =
			process.env.NODE_ENV === "development" ? path.join(__dirname, "tmp") : path.join(os.tmpdir(), "PitkitExtract");
	}

	/**
	 * Given an absolute path to a records file, returns a JS object whose
	 * keys are the exact bracketed section names (with dots intact), and
	 * whose values are the key/value lines inside each section.
	 */
	async #convertRecordsFile(filePath: string): Promise<Records> {
		// copy the file into temp dir
		await cpRecurse(filePath, this.#tmpDir);
		const tmpPath = path.join(this.#tmpDir, path.basename(filePath));

		// read it
		const text = fs.readFileSync(tmpPath, "utf-8");
		const lines = text.split(/\r?\n/);

		const records: Records = {};
		let currentSection: string | null = null;

		for (const line of lines) {
			// section header?
			const sec = line.match(/^\s*\[([^\]]+)\]\s*$/);
			if (sec) {
				currentSection = sec[1];
				records[currentSection] = {};
				continue;
			}

			// key=value inside a section?
			if (currentSection) {
				const kv = line.match(/^\s*([^=]+?)\s*=\s*(.+)$/);
				if (kv) {
					const key = kv[1];
					const val = kv[2];
					records[currentSection][key] = val;
				}
			}
		}

		return records;
	}

	public setProfilesFolder(profilesFolder: string) {
		this.#profilesFolder = profilesFolder;
	}

	public getProfiles() {
		// Return only foldres within the profiles folder, if there are any erroneous files, filter them out
		return fs
			.readdirSync(this.#profilesFolder)
			.filter((e) => fs.statSync(path.join(this.#profilesFolder, e)).isDirectory())
			.map((e) => path.join(this.#profilesFolder, e));
	}

	public async getTrainers(): Promise<TrainerRecord[]> {
		const profiles = this.getProfiles(); // array of profile dirs
		const allTrainers: TrainerRecord[] = [];

		for (const profileDir of profiles) {
			const records = await this.#convertRecordsFile(path.join(profileDir, "records.ini"));
			const trainersDir = path.join(profileDir, "trainers");
			if (!fs.existsSync(trainersDir)) continue;

			const files = fs.readdirSync(trainersDir).filter((f) => f.endsWith(".trn"));

			for (const file of files) {
				const fullPath = path.join(trainersDir, file);
				const base = path.parse(file).name; // e.g. "Farm14_MX1 OEM"
				const idx = base.lastIndexOf("_");
				const mapName = base.slice(0, idx); // "Farm14"
				const bikeRaw = base.slice(idx + 1); // "MX1 OEM"
				const section = records[mapName];
				if (!section) {
					console.warn(`No section “[${mapName}]” in records.ini`);
					continue;
				}

				const bikeNorm = bikeRaw.replace(/[\s_]/g, ""); // "MX1OEM"
				const recordKey = Object.keys(section).find((rk) => rk.split("_")[0] === bikeNorm);

				if (!recordKey) {
					console.warn(`No record for bike category “${bikeRaw}” in section “[${mapName}]”`);
					continue;
				}

				const [lapStr, tsStr] = section[recordKey].split(" ");
				allTrainers.push({
					map: mapName,
					lapTime: parseFloat(lapStr),
					recordedAt: new Date(Number(tsStr) * 1000),
					filePath: fullPath,
				});
			}
		}

		return allTrainers;
	}
}
