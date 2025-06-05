import React from "react";
import { useState, useEffect } from "react";
import "./App.css";
import { Mod, ModsData } from "src/types";
import { FolderPlus } from "lucide-react";
import ModsGrid from "./components/mods-grid/ModsGrid";
import { setupWindowControls } from "./utils/windowControls";
import log from "electron-log/renderer";
import { ToastContainer } from "react-toastify";
import DownloadToast from "./components/toast/DownloadToast";

export default function App() {
	const [progress, setProgress] = useState(null);
	const [modsData, setModsData] = useState<ModsData | null>(null);
	const [isInstalling, setIsInstalling] = useState(false);

	async function installModWithProgress(filePaths?: string[]) {
		try {
			await window.modManagerAPI.installMod(filePaths);
			log.info("Installation complete");
		} catch (error) {
			log.error("Installation failed:", error);
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
			// await fetchModsData();
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

		const cleanupInstallComplete = window.modManagerAPI.onMessage("install-complete", async (message: string) => {
			await window.modalAPI.showModal<boolean>({
				type: "notify",
				title: "Success",
				message,
			});
			fetchModsData();
		});

		const cleanupInstallFailed = window.modManagerAPI.onMessage("install-failed", async (message: string) => {
			setIsInstalling(false);
			setProgress(0);
			await window.modalAPI.showModal<boolean>({
				type: "notify",
				title: "Error",
				message,
			});
		});

		const cleanupModsData = window.modManagerAPI.onMessage("send-mods-data", (data: ModsData) => {
			let modsMap: Map<string, Mod>;

			if (data instanceof Map) {
				// Already a Map, so just use it directly
				modsMap = data;
			} else {
				// Plain object (JSON) ⇒ convert to Map
				modsMap = new Map(Object.entries(data));
			}

			setModsData(modsMap);
			setProgress(100);
			setIsInstalling(false);
		});

		const cleanupInstallProgress = window.modManagerAPI.onMessage("install-progress", (data: number) => {
			setProgress(data);
		});

		// This function will be called when the component unmounts
		return () => {
			console.log("Cleaning up App listeners");
			cleanupInstallComplete();
			cleanupInstallFailed();
			cleanupModsData();
			cleanupInstallProgress();
		};
	}, []);

	useEffect(() => {
		console.log("Retrieved mods data: ", modsData);
	}, [modsData]);

	return (
		<div className="app-container" onDrop={handleDrop} onDragOver={handleDragOver}>
			<div id="app" className="app">
				<DownloadToast />
				<ToastContainer
					position="top-right"
					autoClose={false} // we’ll manage when it closes
					hideProgressBar={false} // show a progress bar in the toast itself
					newestOnTop={false}
					closeOnClick={false}
					pauseOnHover
					draggable={false}
				/>
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
