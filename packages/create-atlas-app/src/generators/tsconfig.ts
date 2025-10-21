import type { AppConfig } from "../create-app.js";

export function generateTsConfig(config: AppConfig) {
	return {
		extends: "@atlas/typescript-config/node-service.json",
		compilerOptions: {
			outDir: "./dist",
			rootDir: "./src",
		},
		include: ["src/**/*"],
		exclude: ["node_modules", "dist", "test"],
	};
}
