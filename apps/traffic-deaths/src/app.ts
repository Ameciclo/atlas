import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import summaryRoutes from "./routes/summary/summary.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", summaryRoutes);

export default app;
