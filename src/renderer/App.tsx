import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import { ModsData } from "src/types";
import { FolderPlus } from "lucide-react";
import ModsGrid from "./components/mods-grid/ModsGrid";
import { setupWindowControls } from "./utils/windowControls";
import log from "electron-log/renderer";

export default function App() {
	const [progress, setProgress] = useState(null);
	const [modsData, setModsData] = useState<ModsData | null>(null);
	const [isInstalling, setIsInstalling] = useState(false);

	async function installModWithProgress(filePaths?: string[]) {
		try {
			await window.modManagerAPI.installMod(filePaths);
			alert("Mod successfully installed");
			log.info("Installation complete");
		} catch (error) {
			log.error("Installation failed:", error);
			alert(error);
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
		log.info("Uninstalling mod in App.tsx: ", modName);
		await window.modManagerAPI.uninstallMod(modName);
		await fetchModsData();
	}

	async function fetchModsData() {
		log.info("Fetching mods data...");
		const mods = await window.modManagerAPI.requestModsData();
		setModsData(mods);
	}

	// Effect to handle completion of installation
	useEffect(() => {
		// Only refresh data when both conditions are met
		(async () => {
			if (progress === 100 && isInstalling) {
				log.info("Both progress complete and installation complete, refreshing data");
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
			log.info("Got file path: ", filePath);
			filePaths.push(filePath);
		}

		log.info("Got dropped file paths: ", filePaths);
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
			log.info("Recieved mods data message: ", data);
			// Can't receive a Map, we receive an object, so convert it to a Map
			setModsData(new Map(Object.entries(data)));
		});

		window.modManagerAPI.onMessage("install-progress", (data: number) => {
			setProgress(data);
		});
	}, []);

	useEffect(() => {}, [modsData]);

	return (
		<div className="app-container" onDrop={handleDrop} onDragOver={handleDragOver}>
			<div id="app" className="app">
				<div className="app-heading">
					<button disabled={isInstalling} className="btn install-button" onClick={() => handleInstallMod()}>
						<FolderPlus /> <span>Install Mod</span>
					</button>
					{progress !== 0 && parseInt(progress) < 100 && (
						<div>
							<h1>Installing...</h1>
							<p className="progress-percent">{parseInt(progress)}%</p>
							<progress value={progress} max={100} />
						</div>
					)}
				</div>

				{modsData !== null && <ModsGrid modsData={modsData} uninstall={handleUninstallMod} />}
			</div>
		</div>
	);
}
