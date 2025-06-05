import fs from "fs";
import path from "path";
import os from "os";
import { cpRecurse } from "../utils/FileSystemUtils";
import SupabaseService from "./Supabase";
import { computeFileHash } from "../utils/fileHash";
import { downloadFile } from "../utils/downloadFile";
import { ModalManager } from "./ModalManager";
import { mainWindow } from "../main";

interface TrainerRecord {
	map: string;
	laptime: number;
	recordedAt: Date;
	bike: string;
	bikeCategory: string;
	filePath: string;
	fileHash: string;
	fileName: string;
}

type Records = Record<string, Record<string, string>>;
export default class TrainerService {
	#profilesFolder: string;
	#tmpDir: string;
	#supabase: SupabaseService;
	#modalManager: ModalManager;
	constructor(sb: SupabaseService, modalManager: ModalManager, modsFolder: string) {
		this.#modalManager = modalManager;
		this.#profilesFolder = path.join(path.dirname(modsFolder), "profiles");
		this.#tmpDir =
			process.env.NODE_ENV === "development" ? path.join(__dirname, "tmp") : path.join(os.tmpdir(), "PitkitExtract");
		this.#supabase = sb;
	}

	public async installTrainer(trainer: any) {
		const fileName = trainer.mapName + "_" + trainer.bikeCategory + ".trn";

		const profiles = this.getProfiles();
		let profile: string;
		if (profiles.length === 1) {
			profile = profiles[0];
		} else {
			profile = await this.#modalManager.selectOption(
				mainWindow,
				"Select a profile",
				"Which profile would you like the trainer to be on?",
				this.getProfiles().map((profile) => path.basename(profile))
			);
		}

		let profileIdx = -1;
		for (let i = 0; i < profiles.length; ++i) {
			if (path.basename(profiles[i]) === profile) {
				profileIdx = i;
				break;
			}
		}

		if (profileIdx === -1 || profileIdx > profiles.length - 1) {
			throw new Error("Error installing ghost: could not find selected profile");
		}

		const trainersPath = path.join(profiles[profileIdx], "trainers");
		await downloadFile(trainer.fileUrl, path.join(trainersPath, fileName));
		// await downloadFile(trainer.fileUrl, path.join(trainersPath, "test.trn"));
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
		console.log("Setting profiles folder: ", profilesFolder);
		this.#profilesFolder = profilesFolder;
	}

	public getProfiles() {
		// Return only foldres within the profiles folder, if there are any erroneous files, filter them out
		return fs
			.readdirSync(this.#profilesFolder)
			.filter((e) => fs.statSync(path.join(this.#profilesFolder, e)).isDirectory())
			.map((e) => path.join(this.#profilesFolder, e));
	}

	/**
	 * Given a string array of absolute paths to .trn files, compute the file hash and check if the file
	 * has already been uploaded.
	 * Returns the list of file paths that have not been uploaded
	 * @param files
	 */
	async #filterExistingFiles(userId: string, files: string[]) {
		const uniqueFiles: string[] = [];
		console.log("Filtering files: ", files);
		for (const file of files) {
			const fileHash = await computeFileHash(file);
			const { data: existing, error: selectErr } = await this.#supabase.supabase
				.from("trainers")
				.select("id")
				.eq("user_id", userId)
				.eq("file_hash", fileHash)
				.maybeSingle();

			if (selectErr) throw selectErr;

			if (!existing) {
				uniqueFiles.push(file);
			}
		}

		return uniqueFiles;
	}

	public async getTrainers(): Promise<TrainerRecord[]> {
		console.log("profiles dir: ", this.#profilesFolder);
		const profiles = this.getProfiles(); // array of profile dirs
		const allTrainers: TrainerRecord[] = [];

		for (const profileDir of profiles) {
			const records = await this.#convertRecordsFile(path.join(profileDir, "records.ini"));
			const trainersDir = path.join(profileDir, "trainers");
			if (!fs.existsSync(trainersDir)) continue;

			const files = fs
				.readdirSync(trainersDir)
				.filter((f) => f.endsWith(".trn"))
				.map((file) => path.join(trainersDir, file));

			const session = await this.#supabase.getSession();

			// These are the files that do not already exist in s3
			const uniqueFiles = await this.#filterExistingFiles(session?.user?.id, files);

			for (const file of uniqueFiles) {
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

				const bike = recordKey;
				const [lapStr, tsStr] = section[recordKey].split(" ");
				allTrainers.push({
					map: mapName,
					laptime: parseFloat(lapStr),
					recordedAt: new Date(Number(tsStr) * 1000),
					bike: bike,
					bikeCategory: bikeRaw,
					filePath: file,
					fileHash: await computeFileHash(file),
					fileName: path.basename(file),
				});
			}
		}

		return allTrainers;
	}
}
