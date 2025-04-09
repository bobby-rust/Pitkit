import yauzl from "yauzl";
import path from "path";
import fs, { mkdirSync } from "fs";

export default async function extractZip(
	source: string,
	destination: string,
	sendProgress: (progress: number) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		yauzl.open(source, { lazyEntries: true }, (openErr, zipfile) => {
			if (openErr || !zipfile) {
				reject(openErr || new Error("Failed to open zip file"));
				return;
			}

			// Track progress throttling state
			let lastUpdate = 0;
			let pendingUpdate: NodeJS.Timeout | null = null;
			let totalBytes = 0;
			let extractedBytes = 0;

			// First pass: Calculate total bytes
			zipfile.on("entry", (entry) => {
				totalBytes += entry.uncompressedSize;
				zipfile.readEntry();
			});

			zipfile.on("end", () => {
				// Second pass: Actual extraction
				yauzl.open(source, { lazyEntries: true }, (err, innerZip) => {
					if (err || !innerZip) return reject(err);

					innerZip.readEntry();

					innerZip.on("entry", (entry) => {
						const entryPath = path.join(
							destination,
							entry.fileName
						);

						if (/\/$/.test(entry.fileName)) {
							mkdirSync(entryPath, { recursive: true });
							innerZip.readEntry();
						} else {
							mkdirSync(path.dirname(entryPath), {
								recursive: true,
							});

							innerZip.openReadStream(
								entry,
								(readErr, readStream) => {
									if (readErr || !readStream)
										return reject(readErr);

									const writeStream =
										fs.createWriteStream(entryPath);

									readStream.on("data", (chunk) => {
										extractedBytes += chunk.length;
										const progress =
											(extractedBytes / totalBytes) * 100;
										const now = Date.now();

										// Throttle progress updates
										if (now - lastUpdate >= 1000) {
											sendProgress(progress);
											lastUpdate = now;
											if (pendingUpdate) {
												clearTimeout(pendingUpdate);
												pendingUpdate = null;
											}
										} else if (!pendingUpdate) {
											pendingUpdate = setTimeout(() => {
												sendProgress(progress);
												lastUpdate = Date.now();
												pendingUpdate = null;
											}, 10 - (now - lastUpdate));
											// <ms> - (now - lastUpdate)
										}
									});

									readStream.pipe(writeStream);
									writeStream.on("close", () =>
										innerZip.readEntry()
									);
									writeStream.on("error", reject);
								}
							);
						}
					});

					innerZip.on("end", () => {
						// Ensure final update and cleanup
						if (pendingUpdate) clearTimeout(pendingUpdate);
						sendProgress(100);
						resolve();
					});

					innerZip.on("error", reject);
				});
			});

			zipfile.readEntry();
			zipfile.on("error", reject);
		});
	});
}
