// Vite configuration for Electron main process
import { defineConfig } from "vite";
import copy from "rollup-plugin-copy";

export default defineConfig({
	plugins: [
		// After Vite finishes building the renderer, copy ./bin → .vite/bin
		{
			...copy({
				targets: [
					{
						src: "bin/*", // your local bin folder
						dest: ".vite/build/resources/bin", // target inside .vite
					},
				],
				hook: "writeBundle", // run after the bundle is written
			}),
			// rollup-plugin-copy doesn’t properly carry over types,
			// so we need to assert as any to avoid TS errors
			apply: "build" as any,
		},
	],
	// If you need to tweak build/outputDir, leave it default since Forge’s plugin-vite
	// handles it for you (it uses `.vite` under the hood).
});
