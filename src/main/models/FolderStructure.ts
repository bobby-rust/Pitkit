import { FolderEntries } from "src/types";

export class FolderStructure {
	public entries: FolderEntries;

	constructor(entries: FolderEntries = { files: [], subfolders: {} }) {
		this.entries = entries;
	}

	public getEntries(): FolderEntries {
		return this.entries;
	}

	public setEntries(entries: FolderEntries): void {
		this.entries = entries;
	}

	public toJSON(): FolderEntries {
		return this.entries;
	}
}

export default FolderStructure;
