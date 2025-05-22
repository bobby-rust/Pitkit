import React, { useRef, useEffect } from "react";

const MXBModsView: React.FC = () => {
	const webviewRef = useRef<Electron.WebviewTag>(null);

	useEffect(() => {
		const webview = webviewRef.current!;
		// you can also listen here if you need to—for example:
		webview.addEventListener("did-finish-load", () => {
			console.log("mod site loaded:", webview.getURL());
		});
	}, []);

	return (
		<div style={{ width: "100%", height: "100%", marginTop: "32px" }}>
			<webview
				ref={webviewRef}
				src="https://mxb-mods.com"
				style={{ width: "100%", height: "100%", border: 0 }}
				partition="persist:mods"
			/>
		</div>
	);
};

export default MXBModsView;
