// In your MXBModsView React component
import React, { useRef, useEffect } from "react";

const MXBModsView: React.FC = () => {
        const webviewRef = useRef<Electron.WebviewTag>(null);

        useEffect(() => {
                const wv = webviewRef.current!;
                if (!wv) return;

                const handleNewWindow = (e: any) => {
                        console.log("new-window", e.url);
                        e.preventDefault();
                        wv.loadURL(e.url); // load in the same webview
                };

                const handleWillNavigate = (e: any) => {
                        console.log("will-navigate", e.url);
                };

                wv.addEventListener("new-window", handleNewWindow);
                wv.addEventListener("will-navigate", handleWillNavigate);

                return () => {
                        wv.removeEventListener("new-window", handleNewWindow);
                        wv.removeEventListener("will-navigate", handleWillNavigate);
                };
        }, []);

	return (
                <webview
                        ref={webviewRef}
                        src="https://mxb-mods.com"
                        allowpopups
                        partition="persist:mods"
                        style={{ width: "100%", height: "100%" }}
                />
	);
};

export default MXBModsView;
