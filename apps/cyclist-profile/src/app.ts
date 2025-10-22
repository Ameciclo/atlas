import createApp from "./lib/create-app.js";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.js";
import healthRoutes from "./routes/health.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", cyclistProfilesRoutes);

export default app;
