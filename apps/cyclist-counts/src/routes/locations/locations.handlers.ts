import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";
import { db } from "../../db/index.js";
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
	
	// Convert to GeoJSON features
	const features = nearbyLocations.map(location => ({
		type: "Feature" as const,
		id: location.id,
		properties: {
			id: location.id,
			name: location.name,
			city: location.city,
			state: location.state,
			distance_meters: location.distance_meters,
			metadata: location.metadata,
			created_at: location.created_at,
			updated_at: location.updated_at,
		},
		geometry: {
			type: "Point" as const,
			coordinates: [parseFloat(location.longitude), parseFloat(location.latitude)],
		},
	}));
	
	// Calculate summary by city
	const byCity: Record<string, number> = {};
	features.forEach(f => {
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
