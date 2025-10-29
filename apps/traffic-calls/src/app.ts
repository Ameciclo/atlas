import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import callsRoutes from "./routes/calls/calls.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", callsRoutes);

export default app;
