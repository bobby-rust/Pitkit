import React from "react";
import "./ModCard.css";
import formatDate from "../../utils/formatDate";

interface ModCardProps {
	name: string;
	installDate: string;
	type: string;
}

export default function ModCard({ name, installDate, type }: ModCardProps) {
	function handleDeleteMod(name: string) {
		console.log("Deleting mod (unimplemented): ", name);
	}

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
						onClick={() => handleDeleteMod(name)}
					>
						Uninstall
					</button>
				</div>
			</div>
		</div>
	);
}
