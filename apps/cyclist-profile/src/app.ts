import createApp from "./lib/create-app.ts";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.ts";

const app = createApp().route("/v1/", cyclistProfilesRoutes);

export default app;
