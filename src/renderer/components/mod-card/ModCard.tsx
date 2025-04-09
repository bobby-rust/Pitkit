import React from "react";
import "./ModCard.css";
import formatDate from "../../utils/formatDate";
import { Trash2 } from "lucide-react";

interface ModCardProps {
	name: string;
	installDate: string;
	type: string;
	uninstall: (modName: string) => any;
}

export default function ModCard({
	name,
	installDate,
	type,
	uninstall,
}: ModCardProps) {
	return (
		<div className="mod-card-wrapper">
			<div className="mod-card-container">
				<div className="mod-card-header">
					<h3>{name}</h3>
					<p className="mod-card-type">
						{type[0].toUpperCase() + type.slice(1)}
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
