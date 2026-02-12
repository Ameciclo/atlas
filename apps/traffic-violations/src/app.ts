import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import violationsRoutes from "./routes/violations/violations.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", violationsRoutes);

export default app;
