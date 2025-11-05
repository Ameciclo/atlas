import { createRouter } from "../../lib/create-app.js";
import { listInfrastructureRoute, getInfrastructureRoute } from "./infrastructure.routes.js";
import { listInfrastructure, getInfrastructure } from "./infrastructure.handlers.js";

export const infrastructureRoutes = createRouter()
  .openapi(listInfrastructureRoute, listInfrastructure)
  .openapi(getInfrastructureRoute, getInfrastructure);