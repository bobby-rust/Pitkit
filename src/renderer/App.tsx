import React, { useCallback } from "react";
import { useState, useEffect } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import "./App.css";
import { ModsData } from "src/types/types";
import ModCard from "./components/mod-card/ModCard";
import { FolderPlus } from "lucide-react";

export default function App() {
	const [progress, setProgress] = useState(null);
	const [modsData, setModsData] = useState<ModsData | null>(null);
	const [isMaximized, setIsMaximized] = useState(false);
	async function handleInstallMod() {
		const result = await window.modManagerAPI.installMod();
		console.log("Mod isntall result : ", result);
	}

	async function fetchModsData() {
		const mods = await window.modManagerAPI.requestModsData();
		mods.set("OEM Bikes", mods.get("Rider+"));
		mods.set("AKitBikes", mods.get("Rider+"));
		mods.set("Country Club Track", mods.get("Rider+"));
		mods.set("MX1 OEM Bikes", mods.get("Rider+"));
		mods.set("MX2 OEM Bikes", mods.get("Rider+"));
		mods.set("OEM Enduro Bikes", mods.get("Rider+"));
		setModsData(mods);
	}

	useEffect(() => {
		// Subscribe to progress updates once when component mounts
		window.modManagerAPI.onProgress((progress: number) => {
			console.log(`Progress: ${progress.toFixed(2)}%`);
			setProgress(progress.toFixed(2));
		});

		fetchModsData();
	}, []);

	useEffect(() => {
		console.log(modsData);
	}, [modsData]);

	// --- Function to toggle button visibility / body class ---
	// Use useCallback to prevent redefining the function on every render
	const updateMaximizedState = useCallback((maximized: boolean) => {
		setIsMaximized(maximized); // Update React state (optional)

		const maxButton = document.getElementById("max-button");
		const restoreButton = document.getElementById("restore-button");

		if (maximized) {
			document.body.classList.add("maximized");
			// Optional: Hide Maximize Button, Show Restore Button
			if (maxButton) maxButton.style.display = "none";
			if (restoreButton) restoreButton.style.display = "flex"; // Or 'block'
		} else {
			document.body.classList.remove("maximized");
			// Optional: Show Maximize Button, Hide Restore Button
			if (maxButton) maxButton.style.display = "flex"; // Or 'block'
			if (restoreButton) restoreButton.style.display = "none";
		}
	}, []); // Empty dependency array: function doesn't depend on props/state

	useEffect(() => {
		let cleanupWindowStateListener: (() => void) | null = null;

		const setupWindowControls = async () => {
			// --- Get Button Elements ---
			// It's slightly more React-idiomatic to use refs, but getElementById works fine
			// especially if the titlebar isn't re-rendered often.
			const minButton = document.getElementById("min-button");
			const maxButton = document.getElementById("max-button");
			const restoreButton = document.getElementById("restore-button");
			const closeButton = document.getElementById("close-button");

			// --- Add Click Listeners ---
			const handleMinimize = () => window.electronAPI.minimizeWindow();
			const handleMaximize = () => window.electronAPI.maximizeWindow(); // Main handles toggle
			const handleRestore = () => window.electronAPI.unmaximizeWindow();
			const handleClose = () => window.electronAPI.closeWindow();

			minButton?.addEventListener("click", handleMinimize);
			maxButton?.addEventListener("click", handleMaximize); // Use this if max button should toggle
			restoreButton?.addEventListener("click", handleRestore); // Use this for the dedicated restore button
			closeButton?.addEventListener("click", handleClose);

			// --- Set Initial State ---
			try {
				const initialState =
					await window.electronAPI.getInitialWindowState();
				updateMaximizedState(initialState);
			} catch (error) {
				console.error("Failed to get initial window state:", error);
				updateMaximizedState(false); // Default state on error
			}

			// --- Listen for State Changes from Main Process ---
			cleanupWindowStateListener =
				window.electronAPI.onWindowStateChange(updateMaximizedState);

			// --- Return Cleanup Function for useEffect ---
			return () => {
				console.log("Cleaning up window control listeners");
				minButton?.removeEventListener("click", handleMinimize);
				maxButton?.removeEventListener("click", handleMaximize);
				restoreButton?.removeEventListener("click", handleRestore);
				closeButton?.removeEventListener("click", handleClose);
				if (cleanupWindowStateListener) {
					cleanupWindowStateListener();
				}
				// Fallback cleanup just in case:
				// window.electronAPI.removeAllListeners();
				// Remove class if component unmounts
				document.body.classList.remove("maximized");
			};
		};

		let cleanup: (() => void) | undefined;
		setupWindowControls().then((returnedCleanup) => {
			cleanup = returnedCleanup;
		});

		// This is the actual cleanup function run by useEffect when the component unmounts
		return () => {
			cleanup?.();
		};
	}, [updateMaximizedState]); // Include updateMaximizedState in dependencies
	return (
		<div className="app-container">
			<header id="titlebar">
				{/* Draggable Region - Make sure CSS applies -webkit-app-region: drag */}
				<div
					id="drag-region"
					style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
				>
					<div id="window-title">
						<span>MX Bikes Mod Manager</span>
					</div>
					<div
						id="window-controls"
						style={
							{
								WebkitAppRegion: "no-drag",
							} as React.CSSProperties
						}
					>
						{/* Minimize Button */}
						<div className="button" id="min-button">
							<img
								className="icon"
								alt="minimize" // Add alt text for accessibility
								srcSet="src/renderer/assets/min-w-10.png 1x, src/renderer/assets/min-w-12.png 1.25x, src/renderer/assets/min-w-15.png 1.5x, src/renderer/assets/min-w-15.png 1.75x, src/renderer/assets/min-w-20.png 2x, src/renderer/assets/min-w-20.png 2.25x, src/renderer/assets/min-w-24.png 2.5x, src/renderer/assets/min-w-30.png 3x, src/renderer/assets/min-w-30.png 3.5x"
								draggable="false"
							/>
						</div>

						{/* Maximize Button */}
						<div className="button" id="max-button">
							<img
								className="icon"
								alt="maximize" // Add alt text
								srcSet="src/renderer/assets/max-w-10.png 1x, src/renderer/assets/max-w-12.png 1.25x, src/renderer/assets/max-w-15.png 1.5x, src/renderer/assets/max-w-15.png 1.75x, src/renderer/assets/max-w-20.png 2x, src/renderer/assets/max-w-20.png 2.25x, src/renderer/assets/max-w-24.png 2.5x, src/renderer/assets/max-w-30.png 3x, src/renderer/assets/max-w-30.png 3.5x"
								draggable="false"
							/>
						</div>

						{/* Restore Button (Initially hidden by CSS or the updateMaximizedState function) */}
						<div
							className="button"
							id="restore-button"
							style={{ display: "none" }}
						>
							{" "}
							{/* Default hidden */}
							<img
								className="icon"
								alt="restore" // Add alt text
								srcSet="src/renderer/assets/restore-w-10.png 1x, src/renderer/assets/restore-w-12.png 1.25x, src/renderer/assets/restore-w-15.png 1.5x, src/renderer/assets/restore-w-15.png 1.75x, src/renderer/assets/restore-w-20.png 2x, src/renderer/assets/restore-w-20.png 2.25x, src/renderer/assets/restore-w-24.png 2.5x, src/renderer/assets/restore-w-30.png 3x, src/renderer/assets/restore-w-30.png 3.5x"
								draggable="false"
							/>
						</div>

						{/* Close Button */}
						<div className="button" id="close-button">
							<img
								className="icon"
								alt="close" // Add alt text
								srcSet="src/renderer/assets/close-w-10.png 1x, src/renderer/assets/close-w-12.png 1.25x, src/renderer/assets/close-w-15.png 1.5x, src/renderer/assets/close-w-15.png 1.75x, src/renderer/assets/close-w-20.png 2x, src/renderer/assets/close-w-20.png 2.25x, src/renderer/assets/close-w-24.png 2.5x, src/renderer/assets/close-w-30.png 3x, src/renderer/assets/close-w-30.png 3.5x"
								draggable="false"
							/>
						</div>
					</div>
				</div>
			</header>
			<Sidebar />
			<div id="app" className="app">
				<div className="app-header">
					<h1>MX Bikes Mod Manager</h1>
					<button
						className="install-button"
						onClick={handleInstallMod}
					>
						<FolderPlus /> <span>Install Mod</span>
					</button>
					{progress && (
						<div>
							<h1>Installing...</h1>
							<progress value={progress} max={100}></progress>
						</div>
					)}
				</div>

				{modsData !== null && (
					<div id="mods-container" className="mods-container">
						{Array.from(modsData.entries()).map(([id, mod]) => {
							return (
								<div className="mod-item">
									<ModCard
										key={id}
										name={mod.name}
										type={mod.type}
										installDate={mod.installDate}
									/>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
