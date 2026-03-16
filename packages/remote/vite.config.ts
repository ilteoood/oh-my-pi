import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

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
	test: {
		globals: true,
		environment: "happy-dom",
		setupFiles: ["./test/setup.ts"],
		include: ["test/**/*.test.{ts,tsx}"],
		coverage: {
			provider: "v8",
			include: ["src/**/*.{ts,tsx}"],
			exclude: [
				"src/client/main.tsx",
				"src/client/types.ts",
				"src/client/styles.css",
			],
			thresholds: {
				statements: 90,
				branches: 85,
				functions: 90,
				lines: 90,
			},
		}
	}
});
