export interface FolderEntries {
	files: string[];
	subfolders: { [key: string]: FolderEntries };
}
