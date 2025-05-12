import React, { useState, useEffect } from "react";
import "../Modal.css"; // Shared modal styles

interface TextInputModalProps {
	title: string;
	message: string;
	defaultValue?: string;
	placeholder?: string;
	okLabel?: string;
	cancelLabel?: string;
	onSubmit: (value: string) => void;
	onCancel: () => void;
}

const TextInputModal: React.FC<TextInputModalProps> = ({
	title,
	message,
	defaultValue = "",
	placeholder,
	okLabel = "OK",
	cancelLabel = "Cancel",
	onSubmit,
	onCancel,
}) => {
	const [inputValue, setInputValue] = useState(defaultValue);

	// Focus the input when the modal opens
	useEffect(() => {
		const inputElement = document.getElementById("modal-text-input") as HTMLInputElement;
		inputElement?.focus();
		inputElement?.select(); // Select default text if present
	}, []);

	const handleOkClick = () => {
		onSubmit(inputValue);
	};

	const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(event.target.value);
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			handleOkClick();
		} else if (event.key === "Escape") {
			onCancel();
		}
	};

	return (
		<div className="modal-content">
			<h2 className="modal-title">{title}</h2>
			<p className="modal-message">{message}</p>
			<input
				id="modal-text-input" // ID for focusing
				type="text"
				value={inputValue}
				onChange={handleInputChange}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				className="modal-input"
			/>
			<div className="modal-actions">
				<button onClick={onCancel} className="modal-button cancel">
					{cancelLabel}
				</button>
				<button onClick={handleOkClick} className="modal-button ok">
					{okLabel}
				</button>
			</div>
		</div>
	);
};

export default TextInputModal;
