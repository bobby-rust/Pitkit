import yauzl from "yauzl";
import path from "path";
import fs from "fs";

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
							fs.promises.mkdir(entryPath, { recursive: true });
							innerZip.readEntry();
						} else {
							fs.promises.mkdir(path.dirname(entryPath), {
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
										sendProgress(progress);
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
						console.log("inner zip end");
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
