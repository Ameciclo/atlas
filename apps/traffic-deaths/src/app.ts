import createApp from "./lib/create-app.js";
import byCityRoutes from "./routes/by-city/by-city.index.js";
import byTransportModeRoutes from "./routes/by-transport-mode/by-transport-mode.index.js";
import cyclistRoutes from "./routes/cyclists/cyclists.index.js";
import healthRoutes from "./routes/health.js";
import statsRoutes from "./routes/stats/stats.index.js";
import summaryRoutes from "./routes/summary/summary.index.js";
import timeSeriesRoutes from "./routes/time-series/time-series.index.js";
import v1Routes from "./routes/v1/index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1", v1Routes)
	.route("/v2/", summaryRoutes)
	.route("/v2/", cyclistRoutes)
	.route("/v2/", byCityRoutes)
	.route("/v2/", byTransportModeRoutes)
	.route("/v2/", timeSeriesRoutes)
	.route("/v2/", statsRoutes);

export default app;
