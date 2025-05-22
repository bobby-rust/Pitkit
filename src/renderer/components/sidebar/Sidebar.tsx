import React, { useContext } from "react";
import "./Sidebar.css";
import Logo from "../../Logo";
import { Folder, Ghost, Globe, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../main";

export default function Sidebar() {
	const navigate = useNavigate();

	const username = useContext(UserContext);

	return (
		<div className="sidebar-container">
			<ul>
				<div>
					<li className="logo">
						<Logo />
					</li>
					<div className="divider"></div>
					<div className="sidebar-upper">
						<li>
							<button className="sidebar-button" onClick={() => navigate("/")}>
								<Folder /> All Mods
							</button>
						</li>
						<li>
							<button className="sidebar-button" onClick={() => navigate("/ghosts")}>
								<Ghost />
								Ghosts
							</button>
						</li>
						<li>
							<button className="sidebar-button" onClick={() => navigate("/browse")}>
								<Globe /> Browse
							</button>
						</li>
						{/* <li>
							<button className="sidebar-button">
								<Folder /> Rider
							</button>
						</li>
						<li>
							<button className="sidebar-button">
								<Folder />
								Other
							</button>
						</li> */}
					</div>
				</div>
				<div className="sidebar-lower">
					<li>
						<button className="sidebar-button" onClick={() => navigate("/profile")}>
							<User />
							{username || "Guest"}
						</button>
					</li>
				</div>
			</ul>
		</div>
	);
}
