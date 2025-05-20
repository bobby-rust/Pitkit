import { promises as fs } from "fs";
import { XMLParser } from "fast-xml-parser";
import dotenv from "dotenv";
dotenv.config();

export default class S3 {
	private bucket: string;
	private region: string;
	private parser = new XMLParser({
		ignoreAttributes: false,
		attributeNamePrefix: "",
	});

	constructor() {
		this.bucket = process.env.S3_BUCKET!;
		this.region = process.env.S3_REGION!;

		if (!this.bucket || !this.region) {
			throw new Error("Missing S3_BUCKET or S3_REGION in process.env");
		}
	}

	/**
	 * GET https://bucket.s3.region.amazonaws.com/?list-type=2
	 * Parses the <Key> elements out of the XML response.
	 */
	async listFiles(prefix?: string): Promise<string[]> {
		const url = new URL(`https://${this.bucket}.s3.${this.region}.amazonaws.com/`);
		url.searchParams.set("list-type", "2");
		if (prefix) url.searchParams.set("prefix", prefix);

		const res = await fetch(url.toString());
		if (!res.ok) {
			throw new Error(`S3 list failed: ${res.status} ${res.statusText}`);
		}

		const xml = await res.text();
		const json = this.parser.parse(xml);
		const contents = json.ListBucketResult?.Contents;

		if (!contents) return [];

		// Contents might be a single object or an array
		const items = Array.isArray(contents) ? contents : [contents];
		return items.map((c: any) => c.Key);
	}

	/**
	 * PUT https://bucket.s3.region.amazonaws.com/key
	 * Sets x-amz-acl to public-read.
	 */
	async uploadLocalFile(filePath: string, key?: string): Promise<void> {
		const objectKey = key ?? filePath.split(/[/\\]/).pop()!;
		const buffer = await fs.readFile(filePath);

		const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${encodeURIComponent(objectKey)}`;
		const res = await fetch(url, {
			method: "PUT",
			headers: {
				"Content-Type": "application/octet-stream",
				"x-amz-acl": "public-read",
			},
			body: buffer,
		});

		if (!res.ok) {
			throw new Error(`S3 upload failed: ${res.status} ${res.statusText}`);
		}
	}
}
