import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import infrastructureRoutes from "./routes/infrastructure/index.js";
import relationsRoutes from "./routes/relations/relations.index.js";
import waysRoutes from "./routes/ways/index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1", infrastructureRoutes)
	.route("/v1", relationsRoutes)
	.route("/v1", waysRoutes);

export default app;
