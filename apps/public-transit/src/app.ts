import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import exampleRoutes from "./routes/example/example.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1/", exampleRoutes);

export default app;
