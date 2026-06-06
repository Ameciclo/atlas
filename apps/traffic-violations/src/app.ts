import createApp from "./lib/create-app.js";
import dashboardRoutes from "./routes/dashboard/dashboard.index.js";
import healthRoutes from "./routes/health.js";
import streetsRoutes from "./routes/streets/streets.index.js";
import summaryRoutes from "./routes/violations/summary.index.js";
import violationsRoutes from "./routes/violations/violations.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", violationsRoutes)
	.route("/v1/", summaryRoutes)
	.route("/v1/", streetsRoutes)
	.route("/v1/", dashboardRoutes);

export default app;
