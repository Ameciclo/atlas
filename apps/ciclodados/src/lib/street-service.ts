import { sql } from "drizzle-orm";
import { pcrStreets } from "@atlas/database/schemas/pcr-streets";
import { db } from "./database.js";

export interface StreetMatch {
	id: string;
	name: string;
	confidence: number;
	municipality?: string;
}

export interface StreetDetails {
	id: string;
	name: string;
	geometry: {
		type: "LineString";
		coordinates: number[][];
	};
	properties: Record<string, unknown>;
}

export class StreetService {
	async searchStreets(query: string, limit: number): Promise<StreetMatch[]> {
		try {
			// Try fuzzy search first
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
		} catch {
			// Fallback to ILIKE if pg_trgm not available
			const searchTerm = `%${query.toUpperCase()}%`;
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

	async getStreetById(streetId: string): Promise<StreetDetails | null> {
		const result = await db
			.select({
				id: pcrStreets.id,
				name: pcrStreets.nlogra_conc,
				officialName: pcrStreets.nlgpav_ofic,
				resumedName: pcrStreets.nlgpav_resu,
				coordinates: pcrStreets.coordinates,
				pavementFlag: pcrStreets.flgpav_indp,
				pavementIndicator: pcrStreets.indpav,
				segmentLength: pcrStreets.db2gse_sde,
			})
			.from(pcrStreets)
			.where(sql`${pcrStreets.id} = ${parseInt(streetId)}`)
			.limit(1);

		if (result.length === 0) {
			return null;
		}

		const street = result[0];
		if (!street) {
			return null;
		}
		
		// Parse coordinates (assuming they're stored as JSON string)
		let coordinates: number[][];
		try {
			coordinates = JSON.parse(street.coordinates);
		} catch {
			coordinates = [];
		}

		return {
			id: street.id.toString(),
			name: street.name,
			geometry: {
				type: "LineString",
				coordinates,
			},
			properties: {
				officialName: street.officialName,
				resumedName: street.resumedName,
				pavementFlag: street.pavementFlag,
				pavementIndicator: street.pavementIndicator,
				segmentLength: street.segmentLength,
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