import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import { infrastructureRoutes } from "./routes/infrastructure/index.js";
import { waysRoutes } from "./routes/ways/index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/", infrastructureRoutes)
	.route("/", waysRoutes);

export default app;
