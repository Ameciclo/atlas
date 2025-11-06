import { or, eq, sql, and } from "drizzle-orm";
import { db } from "../../db/index.js";
import * as schema from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { getSummary } from "./summary.routes.js";

export const getSummaryHandler: AppRouteHandler<typeof getSummary> = async (c) => {
	try {
		let editionsRes: any[] = [];
		let total_cyclists_summary = 0;

		let where_max_count = {
			slug: "nowhere",
			total_cyclists: 0,
			date: "",
		};

		const events = await db
			.select()
			.from(schema.countingEvents)
			.leftJoin(schema.countingLocations, eq(schema.countingEvents.location_id, schema.countingLocations.id))
			.execute();

		// Buscar cidades únicas
		const uniqueCities = new Set(events.map(e => `${e.counting_locations?.city}-${e.counting_locations?.state}`));
		const cityConditions = Array.from(uniqueCities)
			.filter(cityState => cityState !== "undefined-undefined")
			.map(cityState => {
				const [city, state] = cityState.split("-");
				return sql`${schema.cities.name} = ${city} AND ${schema.cities.state} = ${state}`;
			});

		const cities = cityConditions.length > 0 
			? await db.select().from(schema.cities).where(or(...cityConditions)).execute()
			: [];

		const cityMapping = new Map(cities.map(city => [`${city.name}-${city.state}`, city]));

		for (const event of events) {
			const { id, counting_date, location_id } = event.counting_events;
			const location = event.counting_locations;

			const totalCyclistsResult = await db
				.select({
					total_cyclists: sql<number>`cast(sum(${schema.sessionMovements.count}) as int)`,
				})
				.from(schema.sessionMovements)
				.leftJoin(
					schema.countingSessions,
					eq(schema.countingSessions.id, schema.sessionMovements.session_id)
				)
				.where(eq(schema.countingSessions.event_id, id))
				.execute();

			const total_cyclists = totalCyclistsResult[0]?.total_cyclists ?? 0;
			total_cyclists_summary += total_cyclists;

			const slugName = location?.name
				?.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^\w\s]/gi, "")
				.replace(/\s+/g, "-")
				.toLowerCase() || "unknown";

			const slugDate = new Date(counting_date).toISOString().slice(0, 10);
			const slug = `${id}-${slugDate}-${slugName}`;

			if (total_cyclists > where_max_count.total_cyclists) {
				where_max_count = {
					slug,
					total_cyclists,
					date: counting_date,
				};
			}

			const cityKey = `${location?.city}-${location?.state}`;
			const cityData = cityMapping.get(cityKey);

			editionsRes.push({
				id,
				slug,
				name: location?.name || "Unknown",
				date: new Date(counting_date).toISOString(),
				city: cityData || {
					id: 0,
					name: location?.city || "Unknown",
					state: location?.state || "Unknown",
				},
				total_cyclists,
			});
		}

		// Calcular características dos dados das sessões
		const sessions = await db.select().from(schema.countingSessions).execute();
		
		let summary = {
			total_cyclists: total_cyclists_summary,
			number_counts: events.length,
			different_counts_points: new Set(events.map(e => e.counting_events.location_id)).size,
			where_max_count,
			total_cargo: 0,
			total_helmet: 0,
			total_juveniles: 0,
			total_motor: 0,
			total_ride: 0,
			total_service: 0,
			total_shared_bike: 0,
			total_sidewalk: 0,
			total_women: 0,
			total_wrong_way: 0,
		};

		// Somar características de todas as sessões
		for (const session of sessions) {
			const characteristics = session.characteristics as any;
			if (characteristics) {
				summary.total_cargo += characteristics.cargo || 0;
				summary.total_helmet += characteristics.helmet || 0;
				summary.total_juveniles += characteristics.juveniles || 0;
				summary.total_motor += characteristics.motor || 0;
				summary.total_ride += characteristics.ride || 0;
				summary.total_service += characteristics.service || 0;
				summary.total_shared_bike += characteristics.shared_bike || 0;
				summary.total_sidewalk += characteristics.sidewalk || 0;
				summary.total_women += characteristics.women || 0;
				summary.total_wrong_way += characteristics.wrong_way || 0;
			}
		}

		return c.json({ counts: editionsRes, summary });
	} catch (error) {
		console.error("Error executing SQL queries:", error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
};