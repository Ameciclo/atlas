import { Hono } from "hono";
import * as handlers from "./streets.handlers.js";

const app = new Hono();

app.get("/streets/name/:name", handlers.getStreetsByName);
app.get("/streets/search", handlers.searchStreets);
app.get("/streets/code/:code", handlers.getStreetByCode);
app.get("/streets/names", handlers.getUniqueStreetNames);

export default app;
