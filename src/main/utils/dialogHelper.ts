import { dialog } from "electron";
import log from "electron-log/main";
import { ModalManager } from "../classes/ModalManager";
import { mainWindow } from "../main";

/**
 * A helper function to show a dialog message box
 * and get the user's response
 *
 * @param title The title of the dialog
 * @param message The message body of the dialog
 * @param buttons The buttons to select from the dialog
 * @returns The selected button, null if cancelled
 */
export async function promptQuestion(
	modalManager: ModalManager,
	title: string,
	message: string,
	buttons: string[]
): Promise<string> {
	const result = await modalManager.selectOption(mainWindow, title, message, [
		...buttons.map((button) => button[0].toUpperCase() + button.slice(1)),
	]);

	return result.toLowerCase();
}

/**
 * Opens a dialog box for the user to select a file.
 *
 * @param title The title of the dialog
 * @param extensions The file extensions that are shown in the dialog. The user can only select these filetypes.
 * @returns The absolute path of the selected file, or null if the user cancelled.
 */
export async function promptSelectFile(title: string, extensions: string[]): Promise<string> {
	const result = await dialog.showOpenDialog({
		properties: ["openFile"],
		filters: [{ name: "Files", extensions }],
		title,
	});

	if (result.canceled || result.filePaths.length === 0) {
		return null;
	}

	return result.filePaths[0];
}
