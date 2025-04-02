import React from "react";
import "./Sidebar.css";
import Logo from "../../Logo";
import { Folder } from "lucide-react";
import { Settings } from "lucide-react";

export default function Sidebar() {
	return (
		<div className="sidebar-container">
			<ul>
				<li className="logo">
					<Logo /> MXB Mod Manager
				</li>
				<div className="divider"></div>
				<li>
					<button className="sidebar-button">
						<Folder /> Mods
					</button>
				</li>
				<li>
					<button className="sidebar-button">
						<Settings /> Settings
					</button>
				</li>
			</ul>
		</div>
	);
}
