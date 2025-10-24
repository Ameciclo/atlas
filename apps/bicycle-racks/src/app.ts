import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import bicycleRacksRoutes from "./routes/bicycle-racks.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", bicycleRacksRoutes);

export default app;
