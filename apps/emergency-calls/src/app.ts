import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import callsRoutes from "./routes/calls/calls.index.js";
import summaryRoutes from "./routes/calls/summary.index.js";
import unsafeStreetsRoutes from "./routes/unsafe-streets/unsafe-streets.index.js";
import analyticsRoutes from "./routes/analytics/analytics.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1", callsRoutes)
	.route("/v1", summaryRoutes)
	.route("/v1", unsafeStreetsRoutes)
	.route("/v1", analyticsRoutes);

export default app;
