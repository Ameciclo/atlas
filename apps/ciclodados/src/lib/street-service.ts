import { sql } from "drizzle-orm";
import { pcrStreets } from "@atlas/database/schemas/pcr-streets";
import { db } from "./database.js";

export interface StreetMatch {
	id: string;
	name: string;
	confidence: number;
	municipality?: string;
	length?: number;
	elements?: number;
}

export interface StreetDetails {
	id: string;
	name: string;
	geometry: {
		type: "FeatureCollection";
		features: Array<{
			type: "Feature";
			geometry: any;
			properties: Record<string, unknown>;
		}>;
	};
	properties: Record<string, unknown>;
}

export class StreetService {
	async searchStreets(query: string, limit: number, byLength?: boolean, byElements?: boolean): Promise<StreetMatch[]> {
		try {
			// Try fuzzy search with conditional ordering
			if (byLength) {
				const fuzzyResults = await db
					.select({
						id: pcrStreets.id,
						name: pcrStreets.nlogra_conc,
						length: pcrStreets.db2gse_sde,
						similarity: sql<number>`similarity(${pcrStreets.nlogra_conc}, ${query})`,
					})
					.from(pcrStreets)
					.where(sql`similarity(${pcrStreets.nlogra_conc}, ${query}) > 0.1`)
					.orderBy(sql`${pcrStreets.db2gse_sde} DESC, similarity(${pcrStreets.nlogra_conc}, ${query}) DESC`)
					.limit(limit);

				return fuzzyResults.map(row => ({
					id: row.id.toString(),
					name: row.name,
					confidence: row.similarity,
					municipality: "Recife",
					length: row.length || undefined,
				}));
			} else {
				const fuzzyResults = await db
					.select({
						id: pcrStreets.id,
						name: pcrStreets.nlogra_conc,
						similarity: sql<number>`similarity(${pcrStreets.nlogra_conc}, ${query})`,
					})
					.from(pcrStreets)
					.where(sql`similarity(${pcrStreets.nlogra_conc}, ${query}) > 0.1`)
					.orderBy(sql`similarity(${pcrStreets.nlogra_conc}, ${query}) DESC`)
					.limit(limit);

				return fuzzyResults.map(row => ({
					id: row.id.toString(),
					name: row.name,
					confidence: row.similarity,
					municipality: "Recife",
				}));
			}
		} catch {
			// Fallback to ILIKE if pg_trgm not available
			const searchTerm = `%${query.toUpperCase()}%`;
			
			if (byLength) {
				const likeResults = await db
					.select({
						id: pcrStreets.id,
						name: pcrStreets.nlogra_conc,
						length: pcrStreets.db2gse_sde,
					})
					.from(pcrStreets)
					.where(sql`UPPER(${pcrStreets.nlogra_conc}) LIKE ${searchTerm}`)
					.orderBy(sql`${pcrStreets.db2gse_sde} DESC, ${pcrStreets.nlogra_conc}`)
					.limit(limit);

				return likeResults.map(row => ({
					id: row.id.toString(),
					name: row.name,
					confidence: 1.0,
					municipality: "Recife",
					length: row.length || undefined,
				}));
			} else {
				const likeResults = await db
					.select({
						id: pcrStreets.id,
						name: pcrStreets.nlogra_conc,
					})
					.from(pcrStreets)
					.where(sql`UPPER(${pcrStreets.nlogra_conc}) LIKE ${searchTerm}`)
					.orderBy(pcrStreets.nlogra_conc)
					.limit(limit);

				return likeResults.map(row => ({
					id: row.id.toString(),
					name: row.name,
					confidence: 1.0,
					municipality: "Recife",
				}));
			}
		}
	}

	async getStreetById(streetId: string): Promise<StreetDetails | null> {
		// First get the street name by ID
		const streetName = await db
			.select({ name: pcrStreets.nlogra_conc })
			.from(pcrStreets)
			.where(sql`${pcrStreets.id} = ${parseInt(streetId)}`)
			.limit(1);

		if (streetName.length === 0 || !streetName[0]) {
			return null;
		}

		// Now get ALL streets with that exact name
		const results = await db
			.select({
				id: pcrStreets.id,
				name: pcrStreets.nlogra_conc,
				officialName: pcrStreets.nlgpav_ofic,
				resumedName: pcrStreets.nlgpav_resu,
				geojson: sql<string>`ST_AsGeoJSON(${pcrStreets.coordinates})`,
				pavementFlag: pcrStreets.flgpav_indp,
				pavementIndicator: pcrStreets.indpav,
				segmentLength: pcrStreets.db2gse_sde,
			})
			.from(pcrStreets)
			.where(sql`${pcrStreets.nlogra_conc} = ${streetName[0].name}`);

		if (results.length === 0) {
			return null;
		}

		// Build FeatureCollection with all segments
		const features = results.map(street => {
			let geometry: any;
			try {
				geometry = JSON.parse(street.geojson);
			} catch {
				geometry = { type: "MultiLineString", coordinates: [] };
			}

			return {
				type: "Feature" as const,
				geometry,
				properties: {
					id: street.id.toString(),
					name: street.name,
					officialName: street.officialName,
					resumedName: street.resumedName,
					pavementFlag: street.pavementFlag,
					pavementIndicator: street.pavementIndicator,
					segmentLength: street.segmentLength,
				}
			};
		});

		const firstStreet = results[0];
		if (!firstStreet) {
			return null;
		}

		return {
			id: streetId,
			name: firstStreet.name,
			geometry: {
				type: "FeatureCollection",
				features
			},
			properties: {
				totalSegments: results.length,
				totalLength: results.reduce((sum, s) => sum + (s.segmentLength || 0), 0),
				officialName: firstStreet.officialName,
				resumedName: firstStreet.resumedName,
			},
		};
	}

	async getStreetsByPoint(lat: number, lng: number, buffer: number): Promise<StreetMatch[]> {
		// Find streets within buffer distance using PostGIS
		const results = await db
			.select({
				id: pcrStreets.id,
				name: pcrStreets.nlogra_conc,
				officialName: pcrStreets.nlgpav_ofic,
			})
			.from(pcrStreets)
			.where(
				sql`ST_DWithin(
					${pcrStreets.coordinates},
					ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326),
					${buffer}
				)`
			)
			.limit(50);

		return results.map(row => ({
			id: row.id.toString(),
			name: row.name,
			confidence: 1.0,
			municipality: "Recife",
		}));
	}
}