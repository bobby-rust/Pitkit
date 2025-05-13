import React from "react";
import { useModal } from "../../context/ModalContext";
import ConfirmModal from "./modals/ConfirmModal";
import TextInputModal from "./modals/TextInputModal";
import SelectModal from "./modals/SelectModal";

import "./Modal.css";
import log from "electron-log/renderer";

// Define the response function type
type SubmitHandler = (value: any) => void;
type CancelHandler = () => void;

const ModalRoot: React.FC = () => {
	const { isOpen, modalProps, hideModal } = useModal();

	console.log("[ModalRoot] isOpen:", isOpen, "modalProps:", modalProps); // <--- Add this

	if (!isOpen || !modalProps) {
		return null; // Don't render anything if modal is closed or props are missing
	}

	// Function to handle submission/cancellation and send response to main
	const handleResponse = (cancelled: boolean, value?: any) => {
		log.info(`[Renderer] Sending response for ${modalProps.id}: Cancelled=${cancelled}, Value=${value}`);
		window.modalAPI.sendModalResponse({
			id: modalProps.id, // Include the ID!
			cancelled: cancelled,
			value: value,
		});
		hideModal(); // Close the modal UI
	};

	const handleSubmit: SubmitHandler = (value) => {
		handleResponse(false, value);
	};

	const handleCancel: CancelHandler = () => {
		handleResponse(true);
	};

	// Render the correct modal based on type
	const renderModalContent = () => {
		switch (modalProps.type) {
			case "confirm":
				return (
					<ConfirmModal
						{...modalProps} // Pass all props down
						onSubmit={() => handleSubmit(true)} // Confirm modal resolves with true
						onCancel={handleCancel}
					/>
				);
			case "textInput":
				return (
					<TextInputModal
						{...modalProps}
						onSubmit={handleSubmit} // onSubmit will receive the text value
						onCancel={handleCancel}
					/>
				);
			case "select":
				return (
					<SelectModal
						{...modalProps}
						onSubmit={handleSubmit} // onSubmit will receive the selected option
						onCancel={handleCancel}
					/>
				);
			// Add cases for other modal types
			default:
				console.warn(`[Renderer] Unknown modal type: ${modalProps.type}`);
				// Render a default error or fallback modal?
				return <div>Unknown modal type requested.</div>;
		}
	};

	return (
		<div className="modal-overlay">
			{" "}
			{/* Outer div for background dimming */}
			<div className="modal-container">
				{" "}
				{/* The actual modal box */}
				{renderModalContent()}
			</div>
		</div>
	);
};

export default ModalRoot;
