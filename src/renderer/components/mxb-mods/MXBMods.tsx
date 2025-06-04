import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./MXBMods.css";

const MXBModsView: React.FC = () => {
	const navigate = useNavigate();
	useEffect(() => {
		window.electronAPI.openMXBModsView();
		return () => {
			window.electronAPI.closeMXBModsView();
		};
	}, []);

	useEffect(() => {
		window.electronAPI.onNavigate((route: string) => navigate(route));

		return () => {
			window.electronAPI.removeNavigateListener();
		};
	}, [navigate]);

	return <div className="mxb-mods">MXB Mods</div>;
};

export default MXBModsView;
