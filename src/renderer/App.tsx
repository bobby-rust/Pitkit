import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import { ModsData } from "src/types/types";
import { FolderPlus } from "lucide-react";
import ModsGrid from "./components/mods-grid/ModsGrid";
import { setupWindowControls, updateWindowState } from "./utils/windowControls";
export default function App() {
	const [progress, setProgress] = useState(null);
	const [modsData, setModsData] = useState<ModsData | null>(null);

	async function handleInstallMod() {
		const result = await window.modManagerAPI.installMod();
		console.log("Mod install result : ", result);
	}

	async function fetchModsData() {
		const mods = await window.modManagerAPI.requestModsData();
		setModsData(mods);
	}

	useEffect(() => {
		// Subscribe to progress updates once when component mounts
		window.modManagerAPI.onProgress((progress: number) => {
			console.log(`Progress: ${progress}%`);
			setProgress(progress);
			if (progress >= 100) {
				console.log("Finished!");
				fetchModsData();
			}
		});

		fetchModsData();
	}, []);

	useEffect(() => {
		console.log(modsData);
	}, [modsData]);

	useEffect(() => {
		setupWindowControls();
	}, [updateWindowState]);

	return (
		<div className="app-container">
			<div id="app" className="app">
				<div className="app-heading">
					<h1>MX Bikes Mod Manager</h1>
					<button
						className="install-button"
						onClick={handleInstallMod}
					>
						<FolderPlus /> <span>Install Mod</span>
					</button>
					{parseInt(progress) < 100 && (
						<div>
							<h1>Installing...</h1>
							<progress value={progress} max={100}></progress>
						</div>
					)}
				</div>
				{modsData !== null && <ModsGrid modsData={modsData} />}
			</div>
		</div>
	);
}
