import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import exampleRoutes from "./routes/example/example.index.js";
import streetsRoutes from "./routes/streets/streets.index.js";
import analyzeRoutes from "./routes/analyze/analyze.index.js";
import nearbyRoutes from "./routes/nearby/nearby.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", exampleRoutes)
	.route("/v1/", streetsRoutes)
	.route("/v1/", analyzeRoutes)
	.route("/v1/", nearbyRoutes);

export default app;
