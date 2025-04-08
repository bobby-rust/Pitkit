import React from "react";
import "./Header.css";

export default function Header() {
  return (
    <header id="titlebar">
      {/* Draggable Region - Make sure CSS applies -webkit-app-region: drag */}
      <div
        id="drag-region"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      >
        <div id="window-title">
          <span>MX Bikes Mod Manager</span>
        </div>
        <div
          id="window-controls"
          style={
            {
              WebkitAppRegion: "no-drag",
            } as React.CSSProperties
          }
        >
          {/* Minimize Button */}
          <div className="button" id="min-button">
            <img
              className="icon"
              alt="minimize" // Add alt text for accessibility
              srcSet="src/renderer/assets/min-w-10.png 1x, src/renderer/assets/min-w-12.png 1.25x, src/renderer/assets/min-w-15.png 1.5x, src/renderer/assets/min-w-15.png 1.75x, src/renderer/assets/min-w-20.png 2x, src/renderer/assets/min-w-20.png 2.25x, src/renderer/assets/min-w-24.png 2.5x, src/renderer/assets/min-w-30.png 3x, src/renderer/assets/min-w-30.png 3.5x"
              draggable="false"
            />
          </div>

          {/* Maximize Button */}
          <div className="button" id="max-button">
            <img
              className="icon"
              alt="maximize"
              srcSet="src/renderer/assets/max-w-10.png 1x, src/renderer/assets/max-w-12.png 1.25x, src/renderer/assets/max-w-15.png 1.5x, src/renderer/assets/max-w-15.png 1.75x, src/renderer/assets/max-w-20.png 2x, src/renderer/assets/max-w-20.png 2.25x, src/renderer/assets/max-w-24.png 2.5x, src/renderer/assets/max-w-30.png 3x, src/renderer/assets/max-w-30.png 3.5x"
              draggable="false"
            />
          </div>

          {/* Restore Button (Initially hidden by CSS or the updateMaximizedState function) */}
          <div
            className="button"
            id="restore-button"
            style={{ display: "none" }}
          >
            {" "}
            {/* Default hidden */}
            <img
              className="icon"
              alt="restore"
              srcSet="src/renderer/assets/restore-w-10.png 1x, src/renderer/assets/restore-w-12.png 1.25x, src/renderer/assets/restore-w-15.png 1.5x, src/renderer/assets/restore-w-15.png 1.75x, src/renderer/assets/restore-w-20.png 2x, src/renderer/assets/restore-w-20.png 2.25x, src/renderer/assets/restore-w-24.png 2.5x, src/renderer/assets/restore-w-30.png 3x, src/renderer/assets/restore-w-30.png 3.5x"
              draggable="false"
            />
          </div>

          {/* Close Button */}
          <div className="button" id="close-button">
            <img
              className="icon"
              alt="close"
              srcSet="src/renderer/assets/close-w-10.png 1x, src/renderer/assets/close-w-12.png 1.25x, src/renderer/assets/close-w-15.png 1.5x, src/renderer/assets/close-w-15.png 1.75x, src/renderer/assets/close-w-20.png 2x, src/renderer/assets/close-w-20.png 2.25x, src/renderer/assets/close-w-24.png 2.5x, src/renderer/assets/close-w-30.png 3x, src/renderer/assets/close-w-30.png 3.5x"
              draggable="false"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
