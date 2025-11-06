import { Hono } from "hono";
import { db } from "../../db/index.js";
import { or, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema.js";

export type city = {
  id: number;
  name: string;
  state: string;
};

export interface CountEdition {
  id: number;
  slug: string;
  name: string;
  date: string;
  coordinates?: CountEditionCoordinates;
  city: city;
  total_cyclists: number;
}

export interface CountEditionCoordinates {
  x: number;
  y: number;
  type: string;
  name: string;
}

export interface MaxCountedDetails {
  slug: string;
  coordinates?: CountEditionCoordinates;
  total_cyclists: number;
  date: string;
}

export interface CountEditionSummary {
  total_cyclists: number;
  number_counts: number;
  different_counts_points: number;
  where_max_count: MaxCountedDetails;
  total_cargo: number;
  total_helmet: number;
  total_juveniles: number;
  total_motor: number;
  total_ride: number;
  total_service: number;
  total_shared_bike: number;
  total_sidewalk: number;
  total_women: number;
  total_wrong_way: number;
  [key: string]: number | MaxCountedDetails; // Allow any string key with number or MaxCountedDetails value
}

const router = new Hono();

// NOTE: This route uses legacy schema that no longer exists in the current database
// It references tables like cyclist_count_edition, cyclist_count_session, direction_count, etc.
// These have been replaced with countingEvents, countingSessions, sessionMovements, etc.
// This route is kept for backward compatibility but should be migrated to use the new schema

router.get("/", async (c) => {
  try {
    // This route references legacy database schema that no longer exists
    // The tables cyclist_count_edition, cyclist_count_session, direction_count, etc.
    // have been replaced with countingEvents, countingSessions, sessionMovements, etc.
    return c.json({ 
      error: "This endpoint uses legacy database schema that no longer exists. Use /v1/summary instead.",
      deprecated: true,
      legacy_schema: true
    }, 410);
    
  } catch (error) {
    console.error("Error executing SQL queries:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

export default router;