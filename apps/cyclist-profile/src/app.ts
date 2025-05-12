import createApp from "./lib/create-app.js";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.js";
import { db } from "./db/index.js";

const app = createApp();

// Add health check endpoint (undocumented)
app.get("/health", async (c) => {
	try {
		// Check database connection
		await db.execute("SELECT 1");

		return c.json(
			{
				status: "okay",
				timestamp: new Date().toISOString(),
				service: "cyclist-profile",
				database: "connected",
			},
			200,
		);
	} catch (error) {
		console.error("Health check failed:", error);

		return c.json(
			{
				status: "error",
				timestamp: new Date().toISOString(),
				service: "cyclist-profile",
				database: "disconnected",
				error: error instanceof Error ? error.message : String(error),
			},
			503,
		);
	}
});

// Add API routes
app.route("/v1/", cyclistProfilesRoutes);

export default app;
