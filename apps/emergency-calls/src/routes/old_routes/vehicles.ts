import { Hono } from "hono";
import { db } from "../../db";
import { trafficCalls } from "../../db/schema";
import { sql } from "drizzle-orm";

const app = new Hono();

app.get("/", async (c) => {
  try {
    const sums = await db
      .select({
        auto: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'cars')::int, 0))`,
        moto: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'motorcycles')::int, 0))`,
        ciclom: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'bicycles')::int, 0))`,
        ciclista: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'cyclists')::int, 0))`,
        pedestre: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'pedestrians')::int, 0))`,
        onibus: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'buses')::int, 0))`,
        caminhao: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'trucks')::int, 0))`,
        viatura: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'police_vehicles')::int, 0))`,
        outros: sql<number>`sum(COALESCE((${trafficCalls.crash_data}->>'vehicles'->>'others')::int, 0))`,
      })
      .from(trafficCalls);

    const row = sums[0];
    return c.json({
      auto: Number(row.auto || 0),
      moto: Number(row.moto || 0),
      ciclom: Number(row.ciclom || 0),
      ciclista: Number(row.ciclista || 0),
      pedestre: Number(row.pedestre || 0),
      onibus: Number(row.onibus || 0),
      caminhao: Number(row.caminhao || 0),
      viatura: Number(row.viatura || 0),
      outros: Number(row.outros || 0),
    });
  } catch (err) {
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default app;