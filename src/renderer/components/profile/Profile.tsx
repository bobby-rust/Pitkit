import React, { useContext, useEffect, useState } from "react";
import "./Profile.css";
import { logout, supabase } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../../main";

export default function Profile() {
	const navigate = useNavigate();
	const username = useContext(UserContext);

	const signOut = () => {
		logout();
		navigate("/");
	};

	return (
		<div className="profile">
			<h1>{username || "Guest"}</h1>
			<div>
				{username ? (
					<button className="btn" onClick={() => signOut()}>
						Sign Out
					</button>
				) : (
					<button className="btn" onClick={() => navigate("/signin")}>
						Sign In
					</button>
				)}
			</div>
		</div>
	);
}
