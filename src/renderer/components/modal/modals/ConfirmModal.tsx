import React, { useEffect, useRef } from "react";
import "../Modal.css"; // Shared modal styles

interface ConfirmModalProps {
	title: string;
	message: string;
	okLabel?: string;
	cancelLabel?: string;
	onSubmit: () => void; // Confirms the action (resolves promise with 'true')
	onCancel: () => void; // Cancels the action (resolves promise with 'null')
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
	title,
	message,
	okLabel = "OK",
	cancelLabel = "Cancel",
	onSubmit,
	onCancel,
}) => {
	const okButtonRef = useRef<HTMLButtonElement>(null);

	// Focus the OK button when the modal mounts
	useEffect(() => {
		okButtonRef.current?.focus();
	}, []);

	// Handle keyboard events for accessibility
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter") {
			event.preventDefault(); // Prevent potential form submission if wrapped
			onSubmit();
		} else if (event.key === "Escape") {
			onCancel();
		}
	};

	return (
		// Add onKeyDown to the container to capture keys globally within the modal
		<div className="modal-content" onKeyDown={handleKeyDown} tabIndex={-1} /* Make div focusable for key events */>
			<h2 className="modal-title">{title}</h2>
			<p className="modal-message">{message}</p>
			<div className="modal-actions">
				<button onClick={onCancel} className="modal-button cancel">
					{cancelLabel}
				</button>
				<button ref={okButtonRef} onClick={onSubmit} className="modal-button ok">
					{okLabel}
				</button>
			</div>
		</div>
	);
};

export default ConfirmModal;
