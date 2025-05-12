import { ipcMain, BrowserWindow, IpcMainEvent } from "electron";
import { IPC_CHANNELS } from "../../shared/ipcChannels";
import log from "electron-log/main";

// Interfaces remain the same
interface ModalOptions {
	type: "confirm" | "textInput" | "select";
	title: string;
	message: string;
	defaultValue?: string;
	placeholder?: string;
	options?: string[];
	okLabel?: string;
	cancelLabel?: string;
}

interface ModalResponse {
	cancelled: boolean;
	value?: any;
}

interface PendingModal {
	resolve: (value: any) => void;
	reject: (reason?: any) => void;
}

export class ModalManager {
	// Private instance members to hold state
	#pendingModals = new Map<string, PendingModal>();
	#nextModalId = 0;

	constructor() {
		// Initialize the listener when the class is instantiated
		this.#initializeResponseListener();
		log.info("[ModalManager] Instance created and response listener initialized.");
	}

	// Private method to set up the IPC listener
	#initializeResponseListener(): void {
		ipcMain.on(IPC_CHANNELS.MODAL_RESPONSE, (event: IpcMainEvent, response: { id: string } & ModalResponse) => {
			const { id, cancelled, value } = response;
			console.log(`[ModalManager] Received response for modal ${id}: Cancelled=${cancelled}, Value=${value}`);
			const pending = this.#pendingModals.get(id);

			if (pending) {
				if (cancelled) {
					pending.resolve(null); // Resolve cancellation with null
				} else {
					pending.resolve(value);
				}
				this.#pendingModals.delete(id); // Clean up
			} else {
				console.warn(`[ModalManager] Received response for unknown or timed out modal ID: ${id}`);
			}
		});
	}

	// Private method to handle the core request logic
	#requestModal<T = any>(window: BrowserWindow, options: ModalOptions): Promise<T | null> {
		return new Promise<T | null>((resolve, reject) => {
			const id = `modal-${this.#nextModalId++}`;
			this.#pendingModals.set(id, { resolve, reject });

			// Validate window before sending
			if (window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
				console.log(`[ModalManager] Sending modal request ${id} to renderer.`);
				window.webContents.send(IPC_CHANNELS.OPEN_MODAL, { id, ...options });
			} else {
				console.error(`[ModalManager] Attempted to send modal request ${id} to invalid window.`);
				reject(new Error("Target window is closed, destroyed, or invalid."));
				this.#pendingModals.delete(id); // Clean up immediately
			}
		});
	}

	// --- Public methods ---

	// Convenience method for confirmation dialogs
	public async confirm(
		window: BrowserWindow,
		title: string,
		message: string,
		okLabel?: string,
		cancelLabel?: string
	): Promise<boolean> {
		const result = await this.#requestModal<boolean>(window, {
			type: "confirm",
			title,
			message,
			okLabel,
			cancelLabel,
		});
		return result === true;
	}

	// Convenience method for text input prompts
	public promptText(
		window: BrowserWindow,
		title: string,
		message: string,
		defaultValue: string = "",
		placeholder?: string,
		okLabel?: string,
		cancelLabel?: string
	): Promise<string | null> {
		return this.#requestModal<string | null>(window, {
			type: "textInput",
			title,
			message,
			defaultValue,
			placeholder,
			okLabel,
			cancelLabel,
		});
	}

	// Convenience method for selection prompts
	public selectOption(
		window: BrowserWindow,
		title: string,
		message: string,
		options: string[],
		okLabel?: string,
		cancelLabel?: string
	): Promise<string | null> {
		return this.#requestModal<string | null>(window, {
			type: "select",
			title,
			message,
			options, // Ensure options are passed
			okLabel,
			cancelLabel,
		});
	}
}
