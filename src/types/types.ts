import path from "path";
import { getModTypeFromModsSubdir } from "src/main/utils/lib";
import { parseZipFile } from "src/main/utils/zipParser";

export interface FolderStructure {
	files: string[];
	subfolders: { [key: string]: FolderStructure }; // This ensures `subfolders` can be indexed by a string
}

export const FolderStructure = {
	async from(source: string): Promise<FolderStructure> {
		if (path.extname(source) === ".zip") {
			return await parseZipFile(source);
		}
		return {
			files: [],
			subfolders: {},
		};
	},
};

export type TrackType = "motocross" | "supercross" | "enduro" | "supermoto";
export type RiderModType = "boots" | "gloves" | "helmet" | "rider"; // "riders" is a whole rider, such as Rider+ or Rider+ Rolled Up
export type ModType = "bike" | "track" | "rider" | "other";

export interface Mod {
	name: string;
	files: FolderStructure;
	installDate: string;
	type: ModType;
	trackType?: TrackType;
}

// Types and values live in separate namespaces
export const Mod = {
	/**
	 * Does not set the track type, even if modType is track.
	 * @param source
	 * @returns
	 */
	async from(source: string): Promise<Mod> {
		const modType = getModTypeFromModsSubdir(source);
		return {
			name: path.parse(source).name,
			files: await FolderStructure.from(source),
			installDate: new Date().toLocaleString(),
			type: modType,
			trackType: null,
		};
	},
};

export type ModsData = Map<string, Mod>;
