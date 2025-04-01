import React from "react";
import "./Sidebar.css";
import Folder from "../../icons/Folder";
import Settings from "../../icons/Settings";
import AppIcon from "../../icons/AppIcon";

export default function Sidebar() {
	return (
		<div className="sidebar-container">
			<ul>
				<li className="logo">
					<AppIcon /> MXB Mod Manager
				</li>
				<div className="divider"></div>
				<li className="sidebar-button">
					<Folder /> Mods
				</li>
				<li className="sidebar-button">
					<Settings /> Settings
				</li>
			</ul>
		</div>
	);
}
