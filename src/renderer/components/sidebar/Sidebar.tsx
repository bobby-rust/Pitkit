import React from "react";
import "./Sidebar.css";
import Logo from "../../Logo";
import { Folder } from "lucide-react";
import { Settings } from "lucide-react";

export default function Sidebar() {
	return (
		<div className="sidebar-container">
			<ul>
				<div>
					<li className="logo">
						<Logo /> PitKit Mod Manager
					</li>
					<div className="divider"></div>
					<div className="sidebar-upper">
						<li>
							<button className="sidebar-button">
								<Folder /> All Mods
							</button>
						</li>
						<li>
							<button className="sidebar-button">
								<Folder /> Bikes
							</button>
						</li>
						<li>
							<button className="sidebar-button">
								<Folder /> Tracks
							</button>
						</li>
						<li>
							<button className="sidebar-button">
								<Folder /> Rider
							</button>
						</li>
						<li>
							<button className="sidebar-button">
								<Folder />
								Other
							</button>
						</li>
					</div>
				</div>
				<div className="sidebar-lower">
					<li>
						<button className="sidebar-button">
							<Settings /> Settings
						</button>
					</li>
				</div>
			</ul>
		</div>
	);
}
