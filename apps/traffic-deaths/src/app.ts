import createApp from "./lib/create-app.js";
import byCityRoutes from "./routes/by-city/by-city.index.js";
import byTransportModeRoutes from "./routes/by-transport-mode/by-transport-mode.index.js";
import cyclistRoutes from "./routes/cyclists/cyclists.index.js";
import healthRoutes from "./routes/health.js";
import statsRoutes from "./routes/stats/stats.index.js";
import summaryRoutes from "./routes/summary/summary.index.js";
import timeSeriesRoutes from "./routes/time-series/time-series.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", summaryRoutes)
	.route("/v1/", cyclistRoutes)
	.route("/v1/", byCityRoutes)
	.route("/v1/", byTransportModeRoutes)
	.route("/v1/", timeSeriesRoutes)
	.route("/v1/", statsRoutes);

export default app;
