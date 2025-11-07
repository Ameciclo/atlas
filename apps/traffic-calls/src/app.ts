import createApp from "./lib/create-app.js";
import exampleRoutes from "./routes/example/example.index.js";
import healthRoutes from "./routes/health.js";

const app = createApp().route("/", healthRoutes).route("/v1/", exampleRoutes);

export default app;
