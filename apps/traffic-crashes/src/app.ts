import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import crashesRoutes from "./routes/crashes/crashes.index.js";

const app = createApp().route("/", healthRoutes).route("/v1/", crashesRoutes);

export default app;
