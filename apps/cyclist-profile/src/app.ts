import { Hono } from "hono";
import { cors } from "hono/cors";
import { OpenAPIHono } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import { db } from "./db/index.js";
import { cyclistProfiles } from "@atlas/database/schemas/cyclist-profile";
import cyclistProfilesRoutes from "./routes/cyclist-profiles/cyclist-profiles.index.js";
import analyticsRoutes from "./routes/cyclist-profiles/analytics.index.js";
import healthRoutes from "./routes/health.index.js";

import * as analyticsHandlers from "./routes/cyclist-profiles/analytics.handlers.js";

// Completely clean Hono app without any hooks
const cleanApp = new Hono()
	.get("/health", (c) => c.json({ status: "ok", service: "cyclist-profile" }))
	.get("/test", (c) => c.text("Clean app works!"))
	.get("/v1/cyclist-profiles/debug", async (c) => {
		try {
			const result = await db
				.select({ id: cyclistProfiles.id })
				.from(cyclistProfiles)
				.limit(3);
			
			const ids = result.map(r => `ID: ${r.id} (type: ${typeof r.id})`);
			return c.text(ids.join('\n'));
		} catch (error) {
			return c.text(`Error: ${error}`);
		}
	})
	.get("/v1/cyclist-profiles/nearby", async (c) => {
		const lat = Number(c.req.query("lat") || -8.05);
		const lon = Number(c.req.query("lon") || -34.88);
		const radius = Number(c.req.query("radius") || 1000);
		const limit = Number(c.req.query("limit") || 50);
		
		const profiles = await db
			.select({
				id: cyclistProfiles.id,
				data: cyclistProfiles.data,
				metadata: cyclistProfiles.metadata,
				created_at: cyclistProfiles.created_at,
				updated_at: cyclistProfiles.updated_at
			})
			.from(cyclistProfiles)
			.where(
				sql`coordinates IS NOT NULL AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`
			)
			.orderBy(
				sql`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`
			)
			.limit(limit);
		
		return c.json(profiles);
	})
	.get("/v1/cyclist-profiles/nearby-summary", async (c) => {
		const lat = Number(c.req.query("lat") || -8.05);
		const lon = Number(c.req.query("lon") || -34.88);
		const radius = Number(c.req.query("radius") || 1000);
		const limit = Number(c.req.query("limit") || 50);
		
		const profiles = await db
			.select({
				id: cyclistProfiles.id,
				gender: sql<string>`data->>'gender'`,
				age: sql<number>`(data->>'age')::numeric`,
				days_usage: sql<number>`(data->'days_usage'->>'total')::numeric`,
				bike_type: sql<string>`metadata->>'bike_type'`,
				neighborhood: sql<string>`metadata->>'neighborhood'`,
				survey_year: sql<string>`metadata->>'survey_year'`,
				distance: sql<number>`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`
			})
			.from(cyclistProfiles)
			.where(
				sql`coordinates IS NOT NULL AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`
			)
			.orderBy(
				sql`ST_Distance(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326))`
			)
			.limit(limit);
		
		return c.json({
			total: profiles.length,
			profiles: profiles.map(p => ({
				id: p.id,
				gender: p.gender,
				age: p.age,
				days_per_week: p.days_usage,
				bike_type: p.bike_type,
				neighborhood: p.neighborhood,
				survey_year: p.survey_year,
				distance_meters: Math.round(p.distance)
			}))
		});
	})
	// Analytics endpoints
	.get("/v1/cyclist-profiles/summary", analyticsHandlers.summary)
	.get("/v1/cyclist-profiles/trends", analyticsHandlers.trends)
	.get("/v1/cyclist-profiles/gender-analysis", analyticsHandlers.genderAnalysis)
	.get("/v1/cyclist-profiles/gender-analysis-by-location", async (c) => {
		try {
			const lat = Number(c.req.query("lat") || -8.05);
			const lon = Number(c.req.query("lon") || -34.88);
			const radius = Number(c.req.query("radius") || 1000);
			const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
			
			let filters = [sql`coordinates IS NOT NULL AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`];
			
			if (year) {
				filters.push(sql`metadata->>'survey_year' = ${year.toString()}`);
			}
			
			const whereClause = sql.join(filters, sql` AND `);
			
			// Usage by gender in location
			const usageByGender = await db
				.select({
					gender: sql<string>`data->>'gender'`,
					avg_days: sql<number>`avg((data->'days_usage'->>'total')::numeric)`,
					count: sql<number>`count(*)`
				})
				.from(cyclistProfiles)
				.where(whereClause)
				.groupBy(sql`data->>'gender'`);
			
			return c.json({
				location: { lat, lon, radius },
				year: year || "all",
				usage_by_gender: usageByGender.filter(u => u.gender).map(u => ({
					gender: u.gender,
					avg_days_per_week: u.avg_days ? Number(Number(u.avg_days).toFixed(1)) : 0,
					total_responses: u.count
				}))
			});
		} catch (error) {
			return c.json({ error: error.message }, 500);
		}
	})
	.get("/v1/cyclist-profiles", async (c) => {
		const profiles = await db.select().from(cyclistProfiles);
		return c.json(profiles);
	})
	.get("/v1/cyclist-profiles/safety-analysis", analyticsHandlers.safetyAnalysis)
	.get("/v1/cyclist-profiles/survey-locations", analyticsHandlers.surveyLocations)
	.get("/v1/cyclist-profiles/analysis", async (c) => {
		try {
			const lat = c.req.query("lat") ? Number(c.req.query("lat")) : undefined;
			const lon = c.req.query("lon") ? Number(c.req.query("lon")) : undefined;
			const radius = Number(c.req.query("radius") || 1000);
			const year = c.req.query("year") ? Number(c.req.query("year")) : undefined;
			const gender = c.req.query("gender");
			const race = c.req.query("race");
			const income = c.req.query("income");
			const education = c.req.query("education");
			const age_category = c.req.query("age_category");
			
			// Build filters
			let filters = [];
			
			if (lat && lon) {
				filters.push(sql`coordinates IS NOT NULL AND ST_DWithin(coordinates, ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326), ${radius})`);
			}
			if (year) filters.push(sql`metadata->>'survey_year' = ${year.toString()}`);
			if (gender) filters.push(sql`data->>'gender' = ${gender}`);
			if (race) filters.push(sql`data->>'color_race' = ${race}`);
			if (income) filters.push(sql`data->>'age_standard' = ${income}`);
			if (education) filters.push(sql`data->>'schooling' = ${education}`);
			if (age_category) filters.push(sql`data->>'age_category' = ${age_category}`);
			
			const whereClause = filters.length > 0 ? sql.join(filters, sql` AND `) : sql`1=1`;
			
			const [totalResult] = await db
				.select({ count: sql<number>`count(*)` })
				.from(cyclistProfiles)
				.where(whereClause);
			
			const genderStats = await db
				.select({
					gender: sql<string>`data->>'gender'`,
					count: sql<number>`count(*)`
				})
				.from(cyclistProfiles)
				.where(whereClause)
				.groupBy(sql`data->>'gender'`);
			
			const total = totalResult.count;
			
			return c.json({
				filters: { lat, lon, radius, year, gender, race, income, education, age_category },
				total_responses: total,
				demographics: {
					gender: genderStats.filter(s => s.gender).map(s => ({
						gender: s.gender,
						count: s.count,
						percentage: Number(((s.count / total) * 100).toFixed(1))
					}))
				}
			});
		} catch (error) {
			return c.json({ error: error.message }, 500);
		}
	});

// OpenAPI app (with validation issues)
const openApiApp = new OpenAPIHono({
	strict: false,
	// NO defaultHook!
})
	.use(cors())
	.route("/", healthRoutes)
	.route("/v1/", cyclistProfilesRoutes)
	.route("/v1/", analyticsRoutes);

// Combine both apps
const app = cleanApp.route("/openapi", openApiApp);

export default app;
