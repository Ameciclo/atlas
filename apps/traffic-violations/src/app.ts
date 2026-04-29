import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import violationsRoutes from "./routes/violations/violations.index.js";
import summaryRoutes from "./routes/violations/summary.index.js";
import streetsRoutes from "./routes/streets/streets.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", violationsRoutes)
	.route("/v1/", summaryRoutes)
	.route("/v1/", streetsRoutes);

export default app;
