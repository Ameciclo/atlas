import { createRouter } from "../lib/create-app.js";
import * as handlers from "./bicycle-racks.handlers.js";
import * as routes from "./bicycle-racks.routes.js";

const router = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.stats, handlers.stats)
  .openapi(routes.nearby, handlers.nearby)
  .openapi(routes.geojson, handlers.geojson)
  .openapi(routes.getById, handlers.getById);

export default router;