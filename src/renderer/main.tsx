import { createRoot } from "react-dom/client";
import App from "./App";
import React from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Header from "./components/header/Header";
import "./index.css";
import { ModalProvider } from "./context/ModalContext";
import ModalRoot from "./components/modal/ModalRoot";

const root = createRoot(document.getElementById("root"));

function Main() {
	return (
		<div className="main-container">
			<ModalProvider>
				<Header />
				<Sidebar />
				<App />
				<ModalRoot />
			</ModalProvider>
		</div>
	);
}
root.render(<Main />);
