export interface FolderStructure {
	files: string[];
	subfolders: { [key: string]: FolderStructure }; // This ensures `subfolders` can be indexed by a string
}

export type ModsData = Map<string, FolderStructure>;
