import { createRoot } from "react-dom/client";
import App from "./App";
import React from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Header from "./components/header/Header";
import "./index.css";

const root = createRoot(document.getElementById("root"));

function Main() {
	return (
		<div className="main-container">
			<Header />
			<Sidebar />
			<App />
		</div>
	);
}
root.render(<Main />);
