import createApp from "./lib/create-app.js";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.js";

const app = createApp().route("/v1/", cyclistProfilesRoutes);

export default app;
