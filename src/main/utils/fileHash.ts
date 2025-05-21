import { createReadStream } from "fs";
import crypto from "crypto";

export function computeFileHash(path: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash("sha256");
		const stream = createReadStream(path);
		stream.on("error", reject);
		stream.on("data", (chunk) => hash.update(chunk));
		stream.on("end", () => resolve(hash.digest("hex")));
	});
}
