import createApp from "./lib/create-app.js";
import dashboardRoutes from "./routes/dashboard/dashboard.index.js";
import healthRoutes from "./routes/health.js";
import lawStatsRoutes from "./routes/law-stats/law-stats.index.js";
import streetStatsRoutes from "./routes/street-stats/street-stats.index.js";
import streetsRoutes from "./routes/streets/streets.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", streetsRoutes)
	.route("/v1/", dashboardRoutes)
	.route("/v1/", lawStatsRoutes)
	.route("/v1/", streetStatsRoutes);

export default app;
