import React, { useEffect, useRef } from "react";
import "../Modal.css"; // Shared modal styles

interface NotifyModalProps {
	title: string;
	message: string;
	okLabel?: string;
	onSubmit: () => void; // Confirms the action (resolves promise with 'true')
}

const NotifyModal: React.FC<NotifyModalProps> = ({ title, message, okLabel = "OK", onSubmit }) => {
	const okButtonRef = useRef<HTMLButtonElement>(null);

	// Focus the OK button when the modal mounts
	useEffect(() => {
		okButtonRef.current?.focus();
	}, []);

	// Handle keyboard events for accessibility
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter" || event.key === "Escape") {
			event.preventDefault(); // Prevent potential form submission if wrapped
			onSubmit();
		}
	};

	return (
		// Add onKeyDown to the container to capture keys globally within the modal
		<div className="modal-content" onKeyDown={handleKeyDown} tabIndex={-1} /* Make div focusable for key events */>
			<h2 className="modal-title">{title}</h2>
			<p className="modal-message">{message}</p>
			<div className="modal-actions">
				<button ref={okButtonRef} onClick={onSubmit} className="modal-button ok">
					{okLabel}
				</button>
			</div>
		</div>
	);
};

export default NotifyModal;
