import React from "react";
import { useState, useEffect } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import "./App.css";

export default function App() {
	const [progress, setProgress] = useState(null);
	async function handleInstallMod() {
		const result = await window.modManagerAPI.installMod();
		console.log("Mod install result: ", result);
	}

	useEffect(() => {
		// Subscribe to progress updates once when component mounts
		window.modManagerAPI.onProgress((progress: number) => {
			console.log(`Progress: ${progress.toFixed(2)}%`);
			setProgress(progress.toFixed(2));
		});
	}, []);
	return (
		<div className="app-container">
			<Sidebar />
			<div className="app">
				<h1>MX Bikes Mod Manager</h1>
				<button className="install-button" onClick={handleInstallMod}>
					Install Mod
				</button>
				{progress && <progress value={progress} max={100}></progress>}
			</div>
		</div>
	);
}
