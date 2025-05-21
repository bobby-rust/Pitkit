import fs, { createWriteStream } from "fs";
import path from "path";
import { pipeline } from "stream/promises";

export async function downloadFile(url: string, dest: string): Promise<void> {
	// 1) Ensure parent folder exists
	fs.mkdirSync(path.dirname(dest), { recursive: true });

	// 2) Fetch the URL
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
	}
	if (!response.body) {
		throw new Error("Response body is null");
	}

	// 3) Pipe the response stream into a file
	const fileStream = createWriteStream(dest);

	// response.body in Node 18+ is a ReadableStream
	await pipeline(response.body as unknown as NodeJS.ReadableStream, fileStream);
}
