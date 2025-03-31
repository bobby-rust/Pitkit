import React from "react";
import { useState, useEffect } from "react";

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
		<div>
			<h1>App</h1>
			<button onClick={handleInstallMod}>Install Mod</button>
			{progress}
			{progress &&
				(parseInt(progress) !== 100 ? (
					<p>Progress: {progress}%</p>
				) : (
					<p>Complete!</p>
				))}
		</div>
	);
}
