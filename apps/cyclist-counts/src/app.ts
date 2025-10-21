import createApp from "./lib/create-app.js";
import eventsRoutes from "./routes/events/events.index.js";
import healthRoutes from "./routes/health.js";
import locationsRoutes from "./routes/locations/locations.index.js";
import sessionsRoutes from "./routes/sessions/sessions.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/v1", locationsRoutes)
	.route("/v1", eventsRoutes)
	.route("/v1", sessionsRoutes);

export default app;
