import React, { useCallback } from "react";
import { useState, useEffect } from "react";
import "./App.css";
import { ModsData } from "src/types/types";
import { FolderPlus } from "lucide-react";
import ModsGrid from "./components/mods-grid/ModsGrid";
import { setupWindowControls, updateWindowState } from "./utils/windowControls";

export default function App() {
	const [progress, setProgress] = useState(null);
	const [modsData, setModsData] = useState<ModsData | null>(null);
	const [isInstalling, setIsInstalling] = useState(false);
	const [installComplete, setInstallComplete] = useState(false);

	async function handleInstallMod(filePaths?: string[]) {
		setIsInstalling(true);
		setInstallComplete(false);
		setProgress(0);
		try {
			await window.modManagerAPI.installMod(filePaths);
		} catch (err) {
			console.error(err);
			setIsInstalling(false);
		}
	}

	async function fetchModsData() {
		const mods = await window.modManagerAPI.requestModsData();
		setModsData(mods);
	}

	// Effect to handle completion of installation
	useEffect(() => {
		// Only refresh data when both conditions are met
		if (progress === 100 && installComplete && isInstalling) {
			console.log(
				"Both progress complete and installation complete, refreshing data"
			);
			setIsInstalling(false);
			setProgress(null);
			setInstallComplete(false);
			fetchModsData();
		}
	}, [progress, installComplete, isInstalling]);

	const handleDrop = useCallback((event: React.DragEvent) => {
		event.preventDefault();
		try {
			const files = event.dataTransfer.files;
			if (files.length === 0) return;
			const filePaths = window.electronAPI.getFilePaths(files);
			console.log("Dropped file paths: ", filePaths);
			if (filePaths && filePaths.length > 0) {
				handleInstallMod(filePaths);
			}
		} catch (error) {
			console.error("Error handling drop:", error);
		}
	}, []);

	const handleDragOver = useCallback((event: React.DragEvent) => {
		event.preventDefault();
	}, []);

	useEffect(() => {
		// Subscribe to progress updates
		const progressHandler = (progress: number) => {
			console.log(`Progress: ${progress}%`);
			setProgress(progress);
		};

		// Add listener for installation complete
		const handleInstallComplete = (result: any) => {
			console.log("Installation complete signal received", result);
			setInstallComplete(true);
		};

		window.modManagerAPI.onProgress(progressHandler);
		window.modManagerAPI.onInstallComplete(handleInstallComplete);

		// Initial data fetch only when component mounts
		fetchModsData();

		return () => {
			window.modManagerAPI.removeInstallCompleteListener(
				handleInstallComplete
			);
		};
	}, []);

	useEffect(() => {
		console.log(modsData);
	}, [modsData]);

	useEffect(() => {
		setupWindowControls();
	}, []);

	return (
		<div
			className="app-container"
			onDrop={handleDrop}
			onDragOver={handleDragOver}
		>
			<div id="app" className="app">
				<div className="app-heading">
					<h1>MX Bikes Mod Manager</h1>
					<button
						disabled={isInstalling}
						className="install-button"
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
				{modsData !== null && <ModsGrid modsData={modsData} />}
			</div>
		</div>
	);
}
