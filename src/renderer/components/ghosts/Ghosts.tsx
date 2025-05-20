import React from "react";
import "./Ghosts.css";
import LeaderboardTable from "../leaderboard-table/LeaderboardTable";
export interface LapTime {
	username: string;
	mapName: string;
	lapTime: number; // in seconds
	bike: string;
}
const data: LapTime[] = [
	{
		username: "nonlocal",
		mapName: "Farm14",
		lapTime: 90.1346,
		bike: "OEM Yamaha 250F",
	},
];
export default function Ghosts() {
	return (
		<div className="ghosts">
			<h1>Ghosts</h1>
			<LeaderboardTable data={data} />
		</div>
	);
}
