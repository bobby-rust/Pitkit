import React, { useContext, useEffect, useState } from "react";
import "./Ghosts.css";
import LeaderboardTable, { LapTime } from "../leaderboard-table/LeaderboardTable";
import { UserContext } from "../../main";

export default function Ghosts() {
	const [data, setData] = useState<LapTime[]>(null);
	const username = useContext(UserContext);

	useEffect(() => {
		async function fetchData() {
			// 1) pull your raw rows
			const trainers = await window.supabaseAPI.getTrainers();
			// 2) map them into LapTime

			console.log("Got trainers: ", trainers);
			const lapTimes: LapTime[] = trainers.map(
				(t: { username: any; map: any; laptime: any; bike: any; bike_category: string; file_url: string }) => ({
					username: t.username || "",
					mapName: t.map,
					lapTime: t.laptime,
					bike: t.bike,
					bikeCategory: t.bike_category,
					fileUrl: t.file_url,
				})
			);
			setData(lapTimes);
		}
		fetchData();
	}, []);

	useEffect(() => {
		console.log("set data: ", data);
	}, [data]);
	return (
		<div className="ghosts">
			<h1>Ghosts</h1>
			{!username ? (
				<h2 style={{ textAlign: "center", paddingBottom: "1rem", marginTop: "2rem" }}>
					You must be signed in to view this page
				</h2>
			) : (
				<LeaderboardTable data={data} />
			)}
		</div>
	);
}
