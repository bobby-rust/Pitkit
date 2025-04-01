import { ModsData } from "../../types/types";
import fs from "fs";
import path from "path";
import process from "process";

export function loadMods(): ModsData {
	console.log("CWD: ", process.cwd());
	const filePath = path.normalize("data/mods.json");
	console.log("filePath: ", filePath);
	console.log("Exists? ", fs.existsSync(filePath));
	const modsDataFileContents = fs.readFileSync(filePath, "utf-8").trim();
	console.log("Mods data: ", modsDataFileContents);
	const modsData: ModsData = JSON.parse(modsDataFileContents);

	return modsData;
}
