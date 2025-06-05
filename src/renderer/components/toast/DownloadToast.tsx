import React, { useEffect, useRef } from "react";
import { toast, Id } from "react-toastify";

type DownloadEvent = {
	url: string;
	percent: number;
};

const DownloadToast: React.FC = () => {
	// Keep track of the current toast ID so we can update it
	const toastId = useRef<Id | null>(null);

	useEffect(() => {
		// Handler for incoming progress updates
		const handleProgress = (_: unknown, data: DownloadEvent) => {
			const { url, percent } = data;
			console.log("Progress called!");
			// If we haven't created the toast yet, create it
			if (toastId.current === null) {
				console.log("Creating toast...: ", percent);
				toastId.current = toast.info(`Downloading… ${percent}%`, {
					position: "bottom-right",
					autoClose: false, // don’t auto-close
					hideProgressBar: false, // show progress bar
					closeOnClick: false,
					pauseOnHover: true,
					draggable: false,
				});
			} else {
				// Otherwise update the existing toast's content and progress bar
				console.log("updating toast...: ", percent);
				toast.update(toastId.current, {
					render: `Downloading… ${percent}%`,
					progress: percent / 100, // progress 0.0–1.0
				});
			}
		};

		// Subscribe once
		window.modManagerAPI.onDownloadProgress(handleProgress);

		// Cleanup on unmount
		return () => {
			toast.dismiss(toastId.current!); // remove toast if still open
			window.modManagerAPI.removeDownloadListener();
		};
	}, []);

	return null; // This component doesn't render visible JSX; it just manages the toast logic
};

export default DownloadToast;
