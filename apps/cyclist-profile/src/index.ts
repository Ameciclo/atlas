import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { db } from "./db/index.js";

export const app = new Hono().get("/", async (c) => {
  try {
    const cyclistProfiles = await db.query.cyclistProfiles.findMany();
    return c.json(cyclistProfiles);
  } catch (queryError) {
    console.error("Database query error:", queryError);
    return c.json(
      { error: "Failed to fetch cyclist profiles. Database error." },
      { status: 500 },
    );
  }
});

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
