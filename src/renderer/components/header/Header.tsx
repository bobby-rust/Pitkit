import React, { useEffect, useState } from "react";
import "./Header.css";

export default function Header() {
	const [assetsPath, setAssetsPath] = useState("");
	async function getAssetsPath() {
		return window.electronAPI.getAssetsPath();
	}
	useEffect(() => {
		(async () => {
			const path = await getAssetsPath();
			setAssetsPath(path);
		})();
	}, []);

	return (
		<header id="titlebar">
			{/* Draggable Region - Make sure CSS applies -webkit-app-region: drag */}
			<div
				id="drag-region"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div id="window-title">
					<span>PitKit</span>
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
							srcSet={`${assetsPath}/min-w-10.png 1x, ${assetsPath}/min-w-12.png 1.25x, ${assetsPath}/min-w-15.png 1.5x, ${assetsPath}/min-w-15.png 1.75x, ${assetsPath}/min-w-20.png 2x, ${assetsPath}/min-w-20.png 2.25x, ${assetsPath}/min-w-24.png 2.5x, ${assetsPath}/min-w-30.png 3x, ${assetsPath}/min-w-30.png 3.5x`}
							draggable="false"
						/>
					</div>

					{/* Maximize Button */}
					<div className="button" id="max-button">
						<img
							className="icon"
							alt="maximize"
							srcSet={`${assetsPath}/max-w-10.png 1x, ${assetsPath}/max-w-12.png 1.25x, ${assetsPath}/max-w-15.png 1.5x, ${assetsPath}/max-w-15.png 1.75x, ${assetsPath}/max-w-20.png 2x, ${assetsPath}/max-w-20.png 2.25x, ${assetsPath}/max-w-24.png 2.5x, ${assetsPath}/max-w-30.png 3x, ${assetsPath}/max-w-30.png 3.5x`}
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
							alt="restore"
							srcSet={`${assetsPath}/restore-w-10.png 1x, ${assetsPath}/restore-w-12.png 1.25x, ${assetsPath}/restore-w-15.png 1.5x, ${assetsPath}/restore-w-15.png 1.75x, ${assetsPath}/restore-w-20.png 2x, ${assetsPath}/restore-w-20.png 2.25x, ${assetsPath}/restore-w-24.png 2.5x, ${assetsPath}/restore-w-30.png 3x, ${assetsPath}/restore-w-30.png 3.5x`}
							draggable="false"
						/>
					</div>

					{/* Close Button */}
					<div className="button" id="close-button">
						<img
							className="icon"
							alt="close"
							srcSet={`${assetsPath}/close-w-10.png 1x, ${assetsPath}/close-w-12.png 1.25x, ${assetsPath}/close-w-15.png 1.5x, ${assetsPath}/close-w-15.png 1.75x, ${assetsPath}/close-w-20.png 2x, ${assetsPath}/close-w-20.png 2.25x, ${assetsPath}/close-w-24.png 2.5x, ${assetsPath}/close-w-30.png 3x, ${assetsPath}/close-w-30.png 3.5x`}
							draggable="false"
						/>
					</div>
				</div>
			</div>
		</header>
	);
}
