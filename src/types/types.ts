export interface FolderStructure {
	files: string[];
	subfolders: { [key: string]: FolderStructure }; // This ensures `subfolders` can be indexed by a string
}

export type TrackType = "motocross" | "supercross" | "enduro" | "supermoto";
export type ModType = "bike" | "track" | "rider" | "tyre";

export interface Mod {
	name: string;
	files: FolderStructure;
	installDate: string;
	type: ModType;
	trackType: TrackType;
}

export type ModsData = Map<string, Mod>;
