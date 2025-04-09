import React from "react";
import { ModsData } from "src/types/types";
import ModCard from "../mod-card/ModCard";
import "./ModsGrid.css";

interface ModsGridProps {
	modsData: ModsData;
}

export default function ModsGrid({ modsData }: ModsGridProps) {
	console.log("Rendering mods data: ", modsData);
	return (
		<div id="mods-container" className="mods-container">
			{modsData.size ? (
				Array.from(modsData.entries()).map(([id, mod]) => {
					return (
						<div key={id} className="mod-item">
							<ModCard
								name={mod.name}
								type={mod.type}
								installDate={mod.installDate}
							/>
						</div>
					);
				})
			) : (
				<h2 className="mods-grid-heading">No mods installed.</h2>
			)}
		</div>
	);
}
