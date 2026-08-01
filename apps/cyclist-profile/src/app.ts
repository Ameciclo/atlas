import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.js";
import analyticsRoutes from "./routes/cyclist-profiles/analytics.index.js";
import dictionaryRoutes from "./routes/dictionary/dictionary.index.js";
import categoriesRoutes from "./routes/categories/categories.index.js";
import filtersRoutes from "./routes/filters/filters.index.js";
import crossRoutes from "./routes/cross/cross.index.js";
import pointsRoutes from "./routes/points/points.index.js";
import odRoutes from "./routes/od/od.index.js";
import distributionRoutes from "./routes/distribution/distribution.index.js";
import downloadsRoutes from "./routes/downloads/downloads.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1", dictionaryRoutes)
	.route("/v1", categoriesRoutes)
	.route("/v1", filtersRoutes)
	.route("/v1", crossRoutes)
	.route("/v1", pointsRoutes)
	.route("/v1", odRoutes)
	.route("/v1", distributionRoutes)
	.route("/v1", downloadsRoutes)
	.route("/v1", analyticsRoutes)
	.route("/v1", cyclistProfilesRoutes);

export default app;
