import yauzl from "yauzl";
import path from "path";
import fs from "fs";
import log from "electron-log/main";

export default async function unzip(
	source: string,
	destination: string,
	sendProgress: (progress: number) => void
): Promise<void> {
	return new Promise((resolve, reject) => {
		// Normalize paths to handle spaces and other special characters
		const normalizedSource = path.normalize(source);
		const normalizedDestination = path.normalize(destination);

		yauzl.open(normalizedSource, { lazyEntries: true }, (openErr, zipfile) => {
			if (openErr || !zipfile) {
				log.error("Failed to open zip file:", openErr);
				reject(openErr || new Error("Failed to open zip file"));
				return;
			}

			let totalBytes = 0;
			let extractedBytes = 0;
			let entryCount = 0;

			// First pass: Calculate total bytes
			zipfile.on("entry", (entry) => {
				totalBytes += entry.uncompressedSize;
				entryCount++;
				zipfile.readEntry();
			});

			zipfile.on("end", () => {
				log.info(`Found ${entryCount} entries with total size ${totalBytes} bytes`);

				// Second pass: Actual extraction
				yauzl.open(normalizedSource, { lazyEntries: true }, async (err, innerZip) => {
					if (err || !innerZip) {
						log.error("Failed to open zip for extraction:", err);
						return reject(err || new Error("Failed to open zip for extraction"));
					}

					innerZip.readEntry();

					innerZip.on("entry", async (entry) => {
						// Normalize the entry path
						const entryPath = path.join(normalizedDestination, entry.fileName);
						try {
							if (/\/$/.test(entry.fileName)) {
								// Directory entry
								await fs.promises.mkdir(entryPath, {
									recursive: true,
								});

								innerZip.readEntry();
							} else {
								// File entry
								const dirname = path.dirname(entryPath);
								await fs.promises.mkdir(dirname, {
									recursive: true,
								});

								// Check if the file already exists and handle accordingly
								try {
									await fs.promises.access(entryPath, fs.constants.F_OK);
									log.info(`File already exists: ${entryPath}, will overwrite`);
								} catch (accessErr) {
									// File doesn't exist, which is fine for extraction
								}

								innerZip.openReadStream(entry, (readErr, readStream) => {
									if (readErr || !readStream) {
										log.error(`Failed to open read stream for ${entry.fileName}:`, readErr);

										return reject(readErr || new Error(`Failed to read file from zip: ${entry.fileName}`));
									}

									const writeStream = fs.createWriteStream(entryPath);

									readStream.on("data", (chunk) => {
										extractedBytes += chunk.length;
										const progress = Math.min(99, Math.floor((extractedBytes / totalBytes) * 100));
										sendProgress(progress);
									});

									readStream.pipe(writeStream);

									writeStream.on("close", () => {
										innerZip.readEntry();
									});

									writeStream.on("error", (writeErr) => {
										log.error(`Error writing to ${entryPath}:`, writeErr);
										reject(writeErr);
									});

									readStream.on("error", (streamErr) => {
										log.error(`Error reading from zip for ${entry.fileName}:`, streamErr);
										reject(streamErr);
									});
								});
							}
						} catch (processingErr) {
							log.error(`Error processing entry ${entry.fileName}:`, processingErr);
							reject(processingErr);
						}
					});

					innerZip.on("end", () => {
						log.info("Extraction completed successfully");
						sendProgress(99);
						resolve();
					});

					innerZip.on("error", (zipErr) => {
						log.error("Zip extraction error:", zipErr);
						reject(zipErr);
					});
				});
			});

			zipfile.readEntry();

			zipfile.on("error", (err) => {
				log.error("Error during initial zip reading:", err);
				reject(err);
			});
		});
	});
}
