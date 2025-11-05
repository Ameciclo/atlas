import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import stationsRoutes from "./routes/stations/index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", stationsRoutes);

export default app;
