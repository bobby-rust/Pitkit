// In your MXBModsView React component
import React, { useRef, useEffect } from "react";

const MXBModsView: React.FC = () => {
	const webviewRef = useRef<Electron.WebviewTag>(null);

	useEffect(() => {
		const wv = webviewRef.current!;
		// intercept any link clicks that would open a popup
		wv.addEventListener("new-window", (e: any) => {
			e.preventDefault();
			wv.loadURL(e.url); // load in the same webview
		});
		// intercept regular navigations if you’ve previously blocked them
		wv.addEventListener("will-navigate", (e) => {
			// if you had prevented external before, now just let it go:
			// do nothing, and the webview will navigate
		});
	}, []);

	return (
		<webview
			ref={webviewRef}
			src="https://mxb-mods.com"
			partition="persist:mods"
			style={{ width: "100%", height: "100%" }}
		/>
	);
};

export default MXBModsView;
