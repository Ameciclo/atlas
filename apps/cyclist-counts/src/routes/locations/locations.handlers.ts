import { eq, sql, desc, max } from "drizzle-orm";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
import {
	countingEvents,
	countingSessions,
	sessionMovements,
} from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	GetByIdRoute,
	ListRoute,
	GetNearbyRoute,
} from "./locations.routes.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
	const { city } = c.req.valid("query");

	let locations;
	if (city) {
		// Filter by city if provided
		locations = await db.query.countingLocations.findMany({
			where(fields, operators) {
				return operators.eq(fields.city, city);
			},
		});
	} else {
		// Get all locations
		locations = await db.query.countingLocations.findMany();
	}

	// Add counting events data for each location
	const locationsWithCounts = await Promise.all(
		locations.map(async (location) => {
			const counts = await getLocationSummary(location.id);
			return {
				...location,
				counts,
			};
		}),
	);

	return c.json(locationsWithCounts);
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

	// Add counting events data for the location
	const counts = await getLocationSummary(location.id);
	const locationWithCounts = {
		...location,
		counts,
	};

	return c.json(locationWithCounts, HttpStatusCodes.OK);
};

// Helper function to get location summary data
async function getLocationSummary(locationId: number) {
	// Get all events for this location
	const events = await db.query.countingEvents.findMany({
		where(fields, operators) {
			return operators.eq(fields.location_id, locationId);
		},
		orderBy(fields, operators) {
			return operators.desc(fields.counting_date);
		},
	});

	if (events.length === 0) {
		return [];
	}

	// Get characteristics for each event
	const eventsWithCharacteristics = await Promise.all(
		events.map(async (event) => {
			const sessions = await db
				.select()
				.from(countingSessions)
				.where(eq(countingSessions.event_id, event.id))
				.execute();

			const characteristics = {
				women: 0,
				helmet: 0,
				cargo: 0,
				motor: 0,
				ride: 0,
				rain: 0,
				sidewalk: 0,
				wrong_way: 0,
				juveniles: 0,
				service: 0,
				shared_bike: 0,
				other_behaviors: 0,
				other_active_modes: 0,
				others: 0,
			};

			for (const session of sessions) {
				const sessionChars = session.characteristics as any;
				if (sessionChars) {
					characteristics.women += sessionChars.women || 0;
					characteristics.helmet += sessionChars.helmet || 0;
					characteristics.cargo += sessionChars.cargo || 0;
					characteristics.motor += sessionChars.motor || 0;
					characteristics.ride += sessionChars.ride || 0;
					characteristics.rain += sessionChars.rain || 0;
					characteristics.sidewalk += sessionChars.sidewalk || 0;
					characteristics.wrong_way += sessionChars.wrong_way || 0;
					characteristics.juveniles += sessionChars.juveniles || 0;
					characteristics.service += sessionChars.service || 0;
					characteristics.shared_bike += sessionChars.shared_bike || 0;
					characteristics.other_behaviors += sessionChars.other_behaviors || 0;
					characteristics.other_active_modes +=
						sessionChars.other_active_modes || 0;
					characteristics.others += sessionChars.others || 0;
				}
			}

			return {
				id: event.id,
				date: event.counting_date,
				total_cyclists: event.total_cyclists,
				start_time: event.start_time,
				end_time: event.end_time,
				max_hour_cyclists: event.max_hour_cyclists,
				weather_conditions: event.weather_conditions,
				characteristics,
				notes: event.notes,
			};
		}),
	);

	return eventsWithCharacteristics;
}

// Helper function to calculate distance between two points
function calculateDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const R = 6371000; // Earth's radius in meters
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
		.map((location) => {
			const distance = calculateDistance(
				latitude,
				longitude,
				parseFloat(location.latitude),
				parseFloat(location.longitude),
			);

			return {
				...location,
				distance_meters: Math.round(distance),
			};
		})
		.filter((location) => location.distance_meters <= radiusMeters)
		.sort((a, b) => a.distance_meters - b.distance_meters);

	// Get counting data for nearby locations
	const locationIds = nearbyLocations.map((l) => l.id);
	let countingData: Array<{
		location_id: number;
		counting_date: string;
		total_cyclists: number;
	}> = [];

	if (locationIds.length > 0) {
		countingData = await db
			.select({
				location_id: countingEvents.location_id,
				counting_date: countingEvents.counting_date,
				total_cyclists: countingEvents.total_cyclists,
			})
			.from(countingEvents)
			.where(
				sql`${countingEvents.location_id} IN (${sql.join(
					locationIds.map((id) => sql`${id}`),
					sql`, `,
				)})`,
			)
			.orderBy(countingEvents.counting_date);
	}

	// Group counting data by location
	const countingMap = new Map<
		number,
		Array<{ date: string; total_cyclists: number }>
	>();
	countingData.forEach((d) => {
		if (!countingMap.has(d.location_id)) {
			countingMap.set(d.location_id, []);
		}
		countingMap.get(d.location_id)?.push({
			date: d.counting_date,
			total_cyclists: d.total_cyclists,
		});
	});

	// Convert to GeoJSON features with summary data
	const features = await Promise.all(
		nearbyLocations.map(async (location) => {
			const countings = countingMap.get(location.id) || [];
			const counts = await getLocationSummary(location.id);
			return {
				type: "Feature" as const,
				id: location.id,
				properties: {
					id: location.id,
					name: location.name,
					city: location.city,
					state: location.state,
					distance_meters: location.distance_meters,
					countings: countings,
					counts: counts,
					metadata: location.metadata,
					created_at: location.created_at,
					updated_at: location.updated_at,
				},
				geometry: {
					type: "Point" as const,
					coordinates: [
						parseFloat(location.longitude),
						parseFloat(location.latitude),
					],
				},
			};
		}),
	);

	// Calculate summary by city
	const byCity: Record<string, number> = {};
	features.forEach((f) => {
		const city = f.properties.city;
		byCity[city] = (byCity[city] || 0) + 1;
	});

	return c.json({
		type: "FeatureCollection" as const,
		features,
		summary: {
			total_locations: features.length,
			by_city: byCity,
		},
	});
};
