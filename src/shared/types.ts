export interface ModalOptions {
	type: "confirm" | "textInput" | "select" | "notify";
	title: string;
	message: string;
	defaultValue?: string;
	placeholder?: string;
	options?: string[];
	okLabel?: string;
	cancelLabel?: string;
}
