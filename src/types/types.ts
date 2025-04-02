export interface FolderStructure {
	files: string[];
	subfolders: { [key: string]: FolderStructure }; // This ensures `subfolders` can be indexed by a string
}

export interface Mod {
	name: string;
	files: FolderStructure;
	installDate: string;
	type: "bike" | "track" | "rider" | "other";
}

export type ModsData = Map<string, Mod>;
