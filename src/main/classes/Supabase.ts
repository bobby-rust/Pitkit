// src/services/SupabaseService.ts
import { createClient, Session, SupabaseClient, User } from "@supabase/supabase-js";
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
		const url = process.env.VITE_SUPABASE_URL;
		const key = process.env.VITE_SUPABASE_ANON_KEY;
		this.bucket = process.env.S3_BUCKET!;
		this.region = process.env.S3_REGION!;

		if (!url || !key || !this.bucket || !this.region) {
			throw new Error("Missing one of SUPABASE_URL, SUPABASE_ANON_KEY, S3_BUCKET or S3_REGION in env");
		}

		this.supabase = createClient(url, key);
		this.s3 = new S3();
	}

	setSession(session: { access_token: string; refresh_token: string }) {
		console.log("Setting session: ", session);
		this.supabase.auth.setSession(session);
	}

	async getSession(): Promise<Session | null> {
		const {
			data: { session },
			error,
		} = await this.supabase.auth.getSession();
		console.log("Got session: ", session);
		if (error) throw error;
		return session;
	}

	/** Returns the current User or null */
	async getUser(): Promise<User | null> {
		const {
			data: { user },
			error,
		} = await this.supabase.auth.getUser();
		if (error) throw error;
		return user;
	}

	/**
	 * Uploads the file at `filePath` → S3, then inserts a trainers row.
	 */
	async uploadTrainer(opts: { userId: string; map: string; lapTime: number; filePath: string; fileName: string }) {
		const session = await this.getSession();
		if (!session) throw new Error("Must be signed in to upload trainer");
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

		console.log("Error: ", error);
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
