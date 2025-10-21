import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import locationsRoutes from "./routes/locations/locations.index.js";

const app = createApp().route("/", healthRoutes).route("/v1", locationsRoutes);

export default app;
