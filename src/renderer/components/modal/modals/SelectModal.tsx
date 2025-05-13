import React, { useState, useEffect, useRef } from "react";
import "../Modal.css"; // Shared modal styles
import log from "electron-log/renderer";

interface SelectModalProps {
	title: string;
	message: string;
	options?: string[]; // Array of options for the dropdown
	okLabel?: string;
	cancelLabel?: string;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

const SelectModal: React.FC<SelectModalProps> = ({
	title,
	message,
	options = [],
	okLabel = "OK",
	cancelLabel = "Cancel",
	onSubmit,
	onCancel,
}) => {
	// Initialize state with the first option, or empty string if no options
	const [selectedValue, setSelectedValue] = useState<string>(options[0] || "");
	const selectRef = useRef<HTMLSelectElement>(null);

	log.info("SelectModal rendered");

	// Focus the select element when the modal mounts
	useEffect(() => {
		log.info("SelectModal mounted");
		selectRef.current?.focus();
		return () => {
			log.info("SelectModal unmounted");
		};
	}, []);

	// Update state when the selection changes
	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedValue(event.target.value);
	};

	// Handle OK button click
	const handleOkClick = () => {
		// Only submit if there was actually an option selected
		if (selectedValue) {
			onSubmit(selectedValue);
		} else if (options.length === 0) {
			// If there were no options, maybe treat OK as cancel or submit null?
			// Let's treat it as submitting null/undefined in this edge case,
			// or just disable the OK button if desired.
			// onSubmit(null); // Or handle as needed
			console.warn("SelectModal submitted with no options available/selected.");
			onSubmit(""); // Submit empty string? Or adjust logic.
		} else {
			// An option should theoretically always be selected if list isn't empty
			onSubmit(selectedValue);
		}
	};

	// Handle keyboard events
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (event.key === "Enter") {
			event.preventDefault();
			handleOkClick();
		} else if (event.key === "Escape") {
			onCancel();
		}
	};

	return (
		<div className="modal-content" onKeyDown={handleKeyDown} tabIndex={-1}>
			<h2 className="modal-title">{title}</h2>
			<p className="modal-message">{message}</p>
			<select ref={selectRef} value={selectedValue} onChange={handleSelectChange} className="modal-select">
				{options.map((option, index) => (
					<option key={index} value={option}>
						{option}
					</option>
				))}
				{options.length === 0 && <option disabled>No options available</option>}
			</select>
			<div className="modal-actions">
				<button onClick={onCancel} className="modal-button cancel">
					{cancelLabel}
				</button>
				{/* Disable OK button if no options are available? */}
				<button onClick={handleOkClick} className="modal-button ok" disabled={options.length === 0}>
					{okLabel}
				</button>
			</div>
		</div>
	);
};

export default SelectModal;
