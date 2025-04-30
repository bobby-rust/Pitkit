import React, { useCallback } from "react";
import { useState, useEffect } from "react";
import "./App.css";
import { ModsData } from "src/types/types";
import { FolderPlus } from "lucide-react";
import ModsGrid from "./components/mods-grid/ModsGrid";
import { setupWindowControls } from "./utils/windowControls";

export default function App() {
	const [progress, setProgress] = useState(null);
	const [modsData, setModsData] = useState<ModsData | null>(null);
	const [isInstalling, setIsInstalling] = useState(false);

	async function installModWithProgress(filePaths?: string[]) {
		/**
		 * TODO: Display a success / failure message to the user after mod installation
		 */
		try {
			await window.modManagerAPI.installMod(filePaths);
			console.log("Installation complete");
		} catch (error) {
			console.error("Installation failed:", error);
		}
	}

	const handleInstallMod = async (filePaths?: string[]) => {
		setIsInstalling(true);
		setProgress(0);
		try {
			await installModWithProgress(filePaths);
		} finally {
			setIsInstalling(false);
			setProgress(100);
			await fetchModsData();
		}
	};

	async function handleUninstallMod(modName: string) {
		console.log("Uninstalling mod in App.tsx: ", modName);
		await window.modManagerAPI.uninstallMod(modName);
		await fetchModsData();
	}

	async function fetchModsData() {
		console.log("Fetching mods data...");
		const mods = await window.modManagerAPI.requestModsData();
		setModsData(mods);
	}

	// Effect to handle completion of installation
	useEffect(() => {
		// Only refresh data when both conditions are met
		(async () => {
			if (progress === 100 && isInstalling) {
				console.log(
					"Both progress complete and installation complete, refreshing data"
				);
				setIsInstalling(false);
				setProgress(null);
				await fetchModsData();
			}
		})();
	}, [progress, isInstalling]);

	const handleDrop = (event: React.DragEvent) => {
		event.preventDefault();
		const files = event.dataTransfer.files;
		const filePaths = [];
		for (const file of files) {
			const filePath = window.electronAPI.getFilePath(file);
			console.log("Got file path: ", filePath);
			filePaths.push(filePath);
		}

		console.log("Got dropped file paths: ", filePaths);
		if (filePaths.length > 0) {
			handleInstallMod(filePaths);
		}
	};

	const handleDragOver = (event: React.DragEvent) => {
		event.preventDefault();
	};

	useEffect(() => {
		setupWindowControls();

		// Initial data fetch only when component mounts
		fetchModsData();

		// Listen for main context sending mods data
		window.modManagerAPI.onMessage("send-mods-data", (data: ModsData) => {
			console.log("Recieved mods data message: ", data);
			// Can't receive a Map, we receive an object, so convert it to a Map
			setModsData(new Map(Object.entries(data)));
		});

		window.modManagerAPI.onMessage("install-progress", (data: number) => {
			console.log("install progress: ", data);
			setProgress(data);
		});
	}, []);

	useEffect(() => {
		console.log(modsData);
	}, [modsData]);

	return (
		<div
			className="app-container"
			onDrop={handleDrop}
			onDragOver={handleDragOver}
		>
			<div id="app" className="app">
				<div className="app-heading">
					<h1>PitKit</h1>
					<button
						disabled={isInstalling}
						className="btn install-button"
						onClick={() => handleInstallMod()}
					>
						<FolderPlus /> <span>Install Mod</span>
					</button>
					{progress !== 0 && parseInt(progress) < 100 && (
						<div>
							<h1>Installing...</h1>
							<p className="progress-percent">
								{parseInt(progress)}%
							</p>
							<progress value={progress} max={100} />
						</div>
					)}
				</div>

				{modsData !== null && (
					<ModsGrid
						modsData={modsData}
						uninstall={handleUninstallMod}
					/>
				)}
			</div>
		</div>
	);
}
