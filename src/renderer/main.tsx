import { createRoot } from "react-dom/client";
import App from "./App";
import React, { createContext, useEffect, useState } from "react";
import Sidebar from "./components/sidebar/Sidebar";
import Header from "./components/header/Header";
import "./index.css";
import { ModalProvider } from "./context/ModalContext";
import ModalRoot from "./components/modal/ModalRoot";
import { HashRouter, Routes, Route } from "react-router-dom";
import SignUp from "./components/auth/SignUp";
import SignIn from "./components/auth/SignIn";
import Profile from "./components/profile/Profile";
import { logout, supabase } from "./utils/auth";
import Ghosts from "./components/ghosts/Ghosts";

const root = createRoot(document.getElementById("root"));

export const UserContext = createContext(null);

function Main() {
	const [username, setUsername] = useState(null);

	useEffect(() => {
		async function fetchUser() {
			// V2 API: use getUser()
			const {
				data: { user },
				error,
			} = await supabase.auth.getUser();

			console.log("USER IN SIDEBAR: ", user);

			if (error) {
				console.error("Failed to fetch user:", error);
				await logout();
				return;
			}

			setUsername((user?.user_metadata as any)?.username ?? null);
		}

		fetchUser();

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, session) => {
			if (session?.user) {
				fetchUser(); // user just signed in
				window.supabaseAPI.setSupabaseAuth({
					access_token: session.access_token,
					refresh_token: session.refresh_token,
				});
				window.modManagerAPI.uploadTrainers();
			} else {
				setUsername(null); // user just signed out
				window.supabaseAPI.setSupabaseAuth(null);
			}
		});

		// clean up the listener on unmount
		return () => {
			subscription.unsubscribe();
		};
	}, []);

	return (
		<div className="main-container">
			<ModalProvider>
				<UserContext.Provider value={username}>
					<Header />
					<HashRouter>
						<Sidebar />
						<Routes>
							<Route path="/" element={<App />} />
							<Route path="/signup" element={<SignUp />} />
							<Route path="/signin" element={<SignIn />} />
							<Route path="/profile" element={<Profile />} />
							<Route path="/ghosts" element={<Ghosts />} />
						</Routes>
					</HashRouter>
					<ModalRoot />
				</UserContext.Provider>
			</ModalProvider>
		</div>
	);
}
root.render(<Main />);
