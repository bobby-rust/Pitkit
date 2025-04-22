import fs from "fs";
import path from "path";
import { subdirExistsZip } from "./zipParser";

/**
 * Recursively searches for a subdirectory, and returns the location if it exists, else null
 */
export function subdirExists(source: string, target: string): string | null {
	if (path.extname(source) === ".zip") {
		return subdirExistsZip(source, target);
	}
	const entries = fs.readdirSync(source);

	for (const entry of entries) {
		const fullPath = path.join(source, entry);
		const stat = fs.statSync(fullPath);

		if (stat.isDirectory()) {
			if (entry === target) {
				return fullPath;
			}

			const result = subdirExists(fullPath, target);
			if (result) return result;
		}
	}

	return null;
}
