import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	root: ".",
	publicDir: false,
	build: {
		outDir: "dist/client",
		emptyOutDir: true,
	},
	server: {
		proxy: {
			"/ws": {
				target: "ws://localhost:3848",
				ws: true,
			},
		},
	},
});
