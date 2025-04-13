import React from "react";
import "./ModCard.css";
import formatDate from "../../utils/formatDate";
import { Trash2 } from "lucide-react";

interface ModCardProps {
	name: string;
	installDate: string;
	modType: string;
	trackType: string | null;
	uninstall: (modName: string) => any;
}

function capitalize(str: string): string {
	return str[0].toUpperCase() + str.slice(1);
}

function abbreviateTrackType(trackType: string): "MX" | "SX" {
	return trackType === "supercross" ? "SX" : "MX";
}

export default function ModCard({
	name,
	installDate,
	modType,
	trackType,
	uninstall,
}: ModCardProps) {
	return (
		<div className="mod-card-wrapper">
			<div className="mod-card-container">
				<div className="mod-card-header">
					<h3 className="mod-card-name">{name}</h3>
					<p className="mod-card-type">
						<span>
							{trackType && abbreviateTrackType(trackType)}{" "}
							{capitalize(modType)}
						</span>
					</p>
				</div>
				<div className="mod-card-footer">
					<p>Installed {formatDate(installDate)}</p>
					<button
						className="delete-button"
						onClick={() => uninstall(name)}
					>
						<Trash2 />
					</button>
				</div>
			</div>
		</div>
	);
}
