import React from "react";
import { ModsData } from "src/types/types";
import ModCard from "../mod-card/ModCard";
import "./ModsGrid.css";

interface ModsGridProps {
  modsData: ModsData;
}

export default function ModsGrid({ modsData }: ModsGridProps) {
  return (
    <div id="mods-container" className="mods-container">
      {Array.from(modsData.entries()).map(([id, mod]) => {
        return (
          <div className="mod-item">
            <ModCard
              key={id}
              name={mod.name}
              type={mod.type}
              installDate={mod.installDate}
            />
          </div>
        );
      })}
    </div>
  );
}
