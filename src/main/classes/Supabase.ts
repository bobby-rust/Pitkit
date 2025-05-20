// src/services/SupabaseService.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import S3 from "./S3";
import { v4 as uuidv4 } from "uuid";

export interface Trainer {
	id: number;
	user_id: string;
	map: string;
	laptime: number;
	recorded_at: string;
	file_key: string;
	file_url: string;
}

export default class SupabaseService {
	private supabase: SupabaseClient;
	private s3: S3;
	private bucket: string;
	private region: string;

	constructor() {
		const url = process.env.SUPABASE_URL;
		const key = process.env.SUPABASE_ANON_KEY;
		this.bucket = process.env.S3_BUCKET!;
		this.region = process.env.S3_REGION!;

		if (!url || !key || !this.bucket || !this.region) {
			throw new Error("Missing one of SUPABASE_URL, SUPABASE_ANON_KEY, S3_BUCKET or S3_REGION in env");
		}

		this.supabase = createClient(url, key);
		this.s3 = new S3();
	}

	/**
	 * Uploads the file at `filePath` → S3, then inserts a trainers row.
	 */
	async uploadTrainer(opts: { userId: string; map: string; lapTime: number; filePath: string; fileName: string }) {
		const { userId, map, lapTime, filePath, fileName } = opts;
		const key = `trainers/${uuidv4()}_${fileName}`;

		// 1) upload bytes to S3 anonymously
		await this.s3.uploadLocalFile(filePath, key);

		// 2) insert metadata to Supabase
		const { error } = await this.supabase
			.from("trainers")
			.insert({
				user_id: userId,
				map,
				laptime: lapTime,
				file_key: key,
			})
			.single();

		if (error) throw error;
	}

	/**
	 * Fetches all trainers for a given user, with public URLs.
	 */
	async getTrainers(): Promise<Trainer[]> {
		const { data, error } = await this.supabase.from("trainers").select("*").order("recorded_at", { ascending: false });

		if (error) throw error;

		return data.map((t) => ({
			...t,
			file_url: `https://${this.bucket}.s3.${this.region}.amazons3.com/${encodeURIComponent(t.file_key)}`,
		}));
	}
}
