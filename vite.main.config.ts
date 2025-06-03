import { defineConfig } from "vite";

// Vite configuration for Electron main process
export default defineConfig({
	// Prevent bundling problematic CJS-only ad-blocker dependencies
	optimizeDeps: {
		exclude: ["electron-ad-blocker", "ad-block"],
	},
	build: {
		rollupOptions: {
			external: ["electron-ad-blocker", "ad-block"],
		},
	},
});
