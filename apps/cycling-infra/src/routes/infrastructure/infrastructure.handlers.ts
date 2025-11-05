import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { createConnectedDatabase } from "@atlas/database";
import * as cyclingInfraSchema from "@atlas/database/schemas/cycling-infra";

export async function listInfrastructure(c: Context) {
  const db = await createConnectedDatabase();
  
  try {
    const { type, limit } = c.req.query();
    
    let query = db.select().from(cyclingInfraSchema.ciclomapaInfra);
    
    // Filter by type if provided
    if (type) {
      query = query.where(eq(cyclingInfraSchema.ciclomapaInfra.infra_type, type));
    }
    
    // Apply limit if provided
    if (limit) {
      const limitNum = parseInt(limit);
      if (!isNaN(limitNum) && limitNum > 0) {
        query = query.limit(limitNum);
      }
    } else {
      // Default limit
      query = query.limit(100);
    }
    
    const infrastructure = await query;
    
    return c.json(infrastructure);
  } catch (error) {
    console.error("Error fetching infrastructure:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}

export async function getInfrastructure(c: Context) {
  const db = await createConnectedDatabase();
  
  try {
    const id = Number(c.req.param("id"));
    
    if (isNaN(id)) {
      return c.json({ error: "Invalid ID" }, 400);
    }
    
    const infrastructure = await db
      .select()
      .from(cyclingInfraSchema.ciclomapaInfra)
      .where(eq(cyclingInfraSchema.ciclomapaInfra.id, id))
      .limit(1);
    
    if (infrastructure.length === 0) {
      return c.json({ error: "Infrastructure not found" }, 404);
    }
    
    return c.json(infrastructure[0]);
  } catch (error) {
    console.error("Error fetching infrastructure:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}