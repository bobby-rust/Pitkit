import path from "path";

import FolderStructure from "../main/models/FolderStructure";

export type RiderModType = "boots" | "gloves" | "helmet" | "rider"; // "riders" is a whole rider, such as Rider+ or Rider+ Rolled Up
export type ModType = "bike" | "track" | "rider" | "other";

export interface Mod {
	name: string;
	files: FolderStructure;
	installDate: string;
	type: ModType;
}

// Types and values live in separate namespaces
export const Mod = {
	/**
	 * Does not set the track type, even if modType is track.
	 */
	from(source: string): Mod {
		return {
			name: path.parse(source).name,
			files: new FolderStructure(),
			installDate: new Date().toLocaleString(),
			type: null,
		};
	},
};

export type ModsData = Map<string, Mod>;
