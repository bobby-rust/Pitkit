import yauzl from "yauzl";
import path from "path";
import fs, { mkdirSync } from "fs";

export default async function extractZip(
	source: string,
	destination: string,
	sendProgress: (progress: number) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		yauzl.open(source, { lazyEntries: true }, (err, zipfile) => {
			if (err || !zipfile) {
				reject(err || new Error("Failed to open zip file"));
				return;
			}

			let totalBytes = 0;
			let extractedBytes = 0;
			const entries: yauzl.Entry[] = [];

			zipfile.readEntry();

			zipfile.on("entry", (entry) => {
				entries.push(entry);
				totalBytes += entry.uncompressedSize;
				zipfile.readEntry();
			});

			zipfile.on("end", () => {
				yauzl.open(source, { lazyEntries: true }, (err, zipfile) => {
					if (err || !zipfile) return reject(err);

					zipfile.readEntry();

					zipfile.on("entry", (entry) => {
						const entryPath = path.join(
							destination,
							entry.fileName
						);
						if (/\/$/.test(entry.fileName)) {
							mkdirSync(entryPath, { recursive: true });
							zipfile.readEntry();
						} else {
							mkdirSync(path.dirname(entryPath), {
								recursive: true,
							});

							zipfile.openReadStream(entry, (err, readStream) => {
								if (err || !readStream) return reject(err);

								const writeStream =
									fs.createWriteStream(entryPath);

								readStream.on("data", (chunk) => {
									extractedBytes += chunk.length;
									const progress =
										(extractedBytes / totalBytes) * 100;
									sendProgress(progress);
								});

								readStream.pipe(writeStream);

								writeStream.on("close", () => {
									zipfile.readEntry();
								});

								writeStream.on("error", reject);
							});
						}
					});
				});

				zipfile.on("end", () => {
					sendProgress(100);
					resolve();
				});
				zipfile.on("error", reject);
			});

			zipfile.on("error", reject);
		});
	});
}
