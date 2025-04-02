/**
 * This file will automatically be loaded by vite and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.ts` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import "./index.css";
import "./main";
console.log(
	'👋 This message is being logged by "renderer.ts", included via Vite'
);
// When document has loaded, initialize
document.onreadystatechange = async (event) => {
	// Make async for initial state check
	if (document.readyState === "complete") {
		await handleWindowControls(); // Wait for async setup
	}
};

// Store the cleanup function for the window state listener
let cleanupWindowStateListener: () => void = null;

window.onbeforeunload = (event) => {
	// If window is reloaded, remove the IPC listener
	if (cleanupWindowStateListener) {
		cleanupWindowStateListener(); // Use specific cleanup
	}
	// Or use the more general cleanup if preferred:
	// window.electronAPI.removeAllListeners();
};

async function handleWindowControls() {
	// Make minimise/maximise/restore/close buttons work when they are clicked
	const minButton = document.getElementById("min-button");
	const maxButton = document.getElementById("max-button");
	const restoreButton = document.getElementById("restore-button"); // Make sure this ID exists in your HTML
	const closeButton = document.getElementById("close-button");

	if (minButton) {
		minButton.addEventListener("click", () => {
			window.electronAPI.minimizeWindow();
		});
	}

	if (maxButton) {
		// This button might now toggle maximize/unmaximize
		maxButton.addEventListener("click", () => {
			window.electronAPI.maximizeWindow(); // Main process handles toggling
		});
	}

	if (restoreButton) {
		// This button specifically unmaximizes (restores)
		restoreButton.addEventListener("click", () => {
			window.electronAPI.unmaximizeWindow();
		});
	}

	if (closeButton) {
		closeButton.addEventListener("click", () => {
			window.electronAPI.closeWindow();
		});
	}

	// Function to toggle button visibility / body class based on maximized state
	function toggleMaxRestoreButtons(isMaximized: boolean) {
		if (isMaximized) {
			document.body.classList.add("maximized");
			// Optional: Hide Maximize Button, Show Restore Button
			if (maxButton) maxButton.style.display = "none";
			if (restoreButton) restoreButton.style.display = "flex"; // Or 'block', etc.
		} else {
			document.body.classList.remove("maximized");
			// Optional: Show Maximize Button, Hide Restore Button
			if (maxButton) maxButton.style.display = "flex"; // Or 'block', etc.
			if (restoreButton) restoreButton.style.display = "none";
		}
	}

	// Get initial state and set UI correctly
	try {
		const initialState = await window.electronAPI.getInitialWindowState();
		toggleMaxRestoreButtons(initialState);
	} catch (error) {
		console.error("Failed to get initial window state:", error);
		toggleMaxRestoreButtons(false); // Default to non-maximized on error
	}

	// Listen for state changes from the main process
	cleanupWindowStateListener = window.electronAPI.onWindowStateChange(
		toggleMaxRestoreButtons
	);
}
