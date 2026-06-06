import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import callsRoutes from "./routes/calls/calls.index.js";
import callsSummaryRoutes from "./routes/calls/summary.index.js";
import analyticsRoutes from "./routes/analytics/analytics.index.js";

// V1 Routes
import v1SummaryRoutes from "./routes/v1/summary.index.js";
import v1FiltersRoutes from "./routes/v1/filters.index.js";
import v1StreetsRoutes from "./routes/v1/streets.index.js";
import v1CitiesRoutes from "./routes/v1/cities.index.js";

// V2 Routes
import v2UnsafeStreetsRoutes from "./routes/v2/unsafe-streets/unsafe-streets.index.js";
import v2StreetsHistoryRoutes from "./routes/v2/streets/history/streets-history.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1", callsSummaryRoutes)
	.route("/v1", callsRoutes)
	.route("/v1", v1SummaryRoutes)
	.route("/v1", v1FiltersRoutes)
	.route("/v1", v1StreetsRoutes)
	.route("/v1", v1CitiesRoutes)
	.route("/v1", analyticsRoutes)
	.route("/v2", v2UnsafeStreetsRoutes)
	.route("/v2", v2StreetsHistoryRoutes);

export default app;
