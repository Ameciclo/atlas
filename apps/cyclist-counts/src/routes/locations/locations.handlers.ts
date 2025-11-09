import { eq, sql } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import { countingEvents } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type { GetByIdRoute, ListRoute, GetNearbyRoute } from "./locations.routes.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { city } = c.req.valid("query");

	if (city) {
		// Filter by city if provided
		const locations = await db.query.countingLocations.findMany({
			where(fields, operators) {
				return operators.eq(fields.city, city);
			},
		});
		return c.json(locations);
	}

	// Get all locations
	const locations = await db.query.countingLocations.findMany();
	return c.json(locations);
};

export const getById: AppRouteHandler<GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");

	const location = await db.query.countingLocations.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, id);
		},
	});

	if (!location) {
		return c.json(
			{
				message: HttpStatusPhrases.NOT_FOUND,
			},
			HttpStatusCodes.NOT_FOUND,
		);
	}

	return c.json(location, HttpStatusCodes.OK);
};

// Helper function to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371000; // Earth's radius in meters
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLon = (lon2 - lon1) * Math.PI / 180;
	const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
			Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
			Math.sin(dLon/2) * Math.sin(dLon/2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	return R * c;
}

export const getNearby: AppRouteHandler<GetNearbyRoute> = async (c) => {
	const { lat, lon, radius = "1000" } = c.req.valid("query");
	
	const latitude = parseFloat(lat);
	const longitude = parseFloat(lon);
	const radiusMeters = parseInt(radius, 10);
	
	// Get all locations
	const allLocations = await db.query.countingLocations.findMany();
	
	// Filter by distance and calculate distances
	const nearbyLocations = allLocations
		.map(location => {
			const distance = calculateDistance(
				latitude, 
				longitude, 
				parseFloat(location.latitude), 
				parseFloat(location.longitude)
			);
			
			return {
				...location,
				distance_meters: Math.round(distance)
			};
		})
		.filter(location => location.distance_meters <= radiusMeters)
		.sort((a, b) => a.distance_meters - b.distance_meters);
	
	// Get counting data for nearby locations
	const locationIds = nearbyLocations.map(l => l.id);
	const countingData = await db
		.select({
			location_id: countingEvents.location_id,
			total_cyclists: sql<number>`sum(${countingEvents.total_cyclists})`.as('total_cyclists'),
			years: sql<number[]>`array_agg(distinct extract(year from ${countingEvents.counting_date}))`.as('years')
		})
		.from(countingEvents)
		.where(sql`${countingEvents.location_id} = any(${locationIds})`)
		.groupBy(countingEvents.location_id);
	
	// Create a map for quick lookup
	const countingMap = new Map(countingData.map(d => [d.location_id, d]));
	
	// Convert to GeoJSON features
	const features = nearbyLocations.map(location => {
		const counting = countingMap.get(location.id);
		return {
			type: "Feature" as const,
			id: location.id,
			properties: {
				id: location.id,
				name: location.name,
				city: location.city,
				state: location.state,
				distance_meters: location.distance_meters,
				total_cyclists: counting?.total_cyclists || 0,
				years: counting?.years || [],
				metadata: location.metadata,
				created_at: location.created_at,
				updated_at: location.updated_at,
			},
			geometry: {
				type: "Point" as const,
				coordinates: [parseFloat(location.longitude), parseFloat(location.latitude)],
			},
		};
	});
	
	// Calculate summary by city
	const byCity: Record<string, number> = {};
	let totalCyclists = 0;
	features.forEach(f => {
		const city = f.properties.city;
		byCity[city] = (byCity[city] || 0) + 1;
		totalCyclists += f.properties.total_cyclists;
	});
	
	return c.json({
		type: "FeatureCollection" as const,
		features,
		summary: {
			total_locations: features.length,
			total_cyclists: totalCyclists,
			by_city: byCity,
		},
	});
};
