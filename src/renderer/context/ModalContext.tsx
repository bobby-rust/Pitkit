import React, { createContext, useState, useContext, useCallback, useEffect, ReactNode } from "react";

interface ModalComponentProps {
	id: string; // The unique ID from the main process request
	type: "confirm" | "textInput" | "select";
	title: string;
	message: string;
	defaultValue?: string;
	placeholder?: string;
	options?: string[];
	okLabel?: string;
	cancelLabel?: string;
}

interface ModalContextState {
	isOpen: boolean;
	modalProps: ModalComponentProps | null;
	showModal: (props: ModalComponentProps) => void;
	hideModal: () => void;
}

const ModalContext = createContext<ModalContextState | undefined>(undefined);

interface ModalProviderProps {
	children: ReactNode;
}

export function ModalProvider({ children }: ModalProviderProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [modalProps, setModalProps] = useState<ModalComponentProps | null>(null);

	const showModal = useCallback((props: ModalComponentProps) => {
		console.log("[Renderer] Showing modal:", props);
		setModalProps(props);
		setIsOpen(true);
	}, []);

	const hideModal = useCallback(() => {
		console.log("[Renderer] Hiding modal");
		setIsOpen(false);
		// Delay clearing props slightly for fade-out animations if needed
		setTimeout(() => setModalProps(null), 300); // Adjust timeout as needed
	}, []);

	// Effect to listen for modal requests from the main process
	useEffect(() => {
		const handleOpenModal = (event: Electron.IpcRendererEvent, args: ModalComponentProps) => {
			// Ensure we have an ID before showing
			if (args.id) {
				showModal(args);
			} else {
				console.error("[Renderer] Received modal request without ID:", args);
			}
		};

		window.modalAPI.onOpenModal(handleOpenModal);
		console.log("[Renderer] Modal open listener attached.");

		// Cleanup listener on component unmount
		return () => {
			console.log("[Renderer] Removing modal open listener.");
			window.modalAPI.removeOpenModalListener();
		};
	}, [showModal]);

	return <ModalContext.Provider value={{ isOpen, modalProps, showModal, hideModal }}>{children}</ModalContext.Provider>;
}

// Custom hook to use the modal context
export const useModal = (): ModalContextState => {
	const context = useContext(ModalContext);
	if (context === undefined) {
		throw new Error("useModal must be used within a ModalProvider");
	}
	return context;
};
