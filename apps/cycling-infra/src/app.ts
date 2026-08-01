import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import infrastructureRoutes from "./routes/infrastructure/index.js";
import summaryRoutes from "./routes/infrastructure/summary.index.js";
import relationsRoutes from "./routes/relations/relations.index.js";
import waysRoutes from "./routes/ways/index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/", summaryRoutes)
	.route("/", infrastructureRoutes)
	.route("/", relationsRoutes)
	.route("/", waysRoutes);

export default app;
