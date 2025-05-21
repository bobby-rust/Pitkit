// src/services/SupabaseService.ts
import { createClient, Session, SupabaseClient, User } from "@supabase/supabase-js";
import S3 from "./S3";
import path from "path";

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
	public supabase: SupabaseClient;
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

	async uploadTrainer(opts: {
		userId: string;
		map: string;
		laptime: number;
		filePath: string;
		fileName: string;
		fileHash: string;
		recordedAt: Date;
	}) {
		const session = await this.getSession();
		if (!session) throw new Error("Must be signed in to upload trainer");

		const { userId, map, laptime, filePath, fileName, fileHash, recordedAt } = opts;

		// 1) Build a *deterministic* key based on user + hash
		const s3Key = `trainers/${userId}/${fileHash}${path.extname(fileName)}`;

		// 2) Try inserting the metadata row, but do NOTHING on conflict (same user_id+file_hash)
		const { data, error } = await this.supabase
			.from("trainers")
			.upsert(
				{
					user_id: userId,
					map,
					laptime,
					recorded_at: recordedAt.toISOString(),
					file_hash: fileHash,
					file_key: s3Key,
				},
				{
					onConflict: "user_id,file_hash",
					ignoreDuplicates: true,
				}
			)
			.select("*");

		if (error) {
			// only real errors (e.g. FK violations) should bubble
			throw error;
		}

		// 3) If `data` is empty, it meant a conflict happened → skip S3
		if (!data || data?.length === 0) {
			console.log(`↩️  Trainer ${fileName} already exists; skipping S3 upload.`);
			return;
		}

		// 4) Otherwise *upload* to S3 now that the row is safely in your DB
		await this.s3.uploadLocalFile(filePath, s3Key);

		console.log(`✅  Uploaded ${fileName} → S3 and recorded in DB.`);
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
