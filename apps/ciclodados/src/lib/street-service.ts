import { sql } from "drizzle-orm";
import { pcrStreets } from "@atlas/database/schemas/pcr-streets";
import { countingLocations } from "@atlas/database/schemas/cyclist-counts";

import { emergencyCalls } from "@atlas/database/schemas/emergency-calls";

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
			geometry: unknown;
			properties: Record<string, unknown>;
		}>;
	};
	properties: Record<string, unknown>;
}

// Static research locations with correct coordinates
const RESEARCH_LOCATIONS = [
	{
		street: "Rua do Futuro x Avenida Dr. Malaquias",
		coordinates: [-34.90176, -8.03876],
	},
	{
		street: "Avenida Professor José dos Anjos x Avenida Beberibe",
		coordinates: [-34.89293, -8.02793],
	},
	{
		street: "Estrada do Arraial x Rua Padre Lemos",
		coordinates: [-34.91773, -8.02676],
	},
	{
		street: "Avenida Arquiteto Luiz Nunes x Rua Engenheiro Alves de Souza",
		coordinates: [-34.91224, -8.09803],
	},
	{
		street: "Avenida General San Martin x Avenida Abdias de Carvalho",
		coordinates: [-34.92576, -8.06046],
	},
	{
		street: "Avenida Recife x Rua Pintor Antonio de Albuquerque",
		coordinates: [-34.92706, -8.10793],
	},
	{
		street: "Avenida Recife x Rua Pintor Antônio de Albuquerque",
		coordinates: [-34.92706, -8.10793],
	},
	{
		street: "Avenida Caxangá x Avenida General San Martin",
		coordinates: [-34.92105, -8.05045],
	},
	{
		street: "Avenida Caxangá x Avenida Afonso Olindense",
		coordinates: [-34.95573, -8.0313],
	},
	{
		street: "Avenida Engenheiro Domingos Ferreira x Rua Antônio Falcão",
		coordinates: [-34.89552, -8.11574],
	},
	{
		street: "Avenida do Forte do Bom Jesus x Rua Gomes Taborda",
		coordinates: [-34.92892, -8.05351],
	},
	{
		street: "Estrada de Belém x Rua Odorico Mendes",
		coordinates: [-34.88138, -8.03216],
	},
	{
		street: "Rua Cosme Viana x Rua Vinte e Um de Abril",
		coordinates: [-34.90919, -8.07701],
	},
	{
		street: "Avenida Governador Agamenon Magalhães x Praça do Derby",
		coordinates: [-34.89772, -8.05661],
	},
	{
		street: "Avenida Cruz Cabugá x Rua Dr. Jayme da Fonte",
		coordinates: [-34.87489, -8.04448],
	},
	{
		street: "Av. Guararapes x Av. Dantas Barreto",
		coordinates: [-34.87848, -8.06392],
	},
	{
		street: "R. Souza Bandeira x R. Cantora Clara Nunes",
		coordinates: [-34.91665, -8.04425],
	},
];

export class StreetService {
	async getStreetDataSummary(
		streetId: string,
	): Promise<{
		street_id: string;
		street_name: string;
		data_summary: unknown;
	} | null> {
		// Get street info first
		const street = await db
			.select({ name: pcrStreets.nlogra_conc })
			.from(pcrStreets)
			.where(sql`${pcrStreets.id} = ${parseInt(streetId, 10)}`)
			.limit(1);

		if (street.length === 0 || !street[0]) {
			return null;
		}

		// Get cycling counts within 30m of street geometry
		let cycling_counts = 0;
		try {
			const countResult = await db
				.select({ count: sql<number>`COUNT(*)` })
				.from(countingLocations)
				.where(
					sql`EXISTS (
						SELECT 1
						FROM pcr_streets ps
						WHERE ps.nlogra_conc = ${street[0]?.name}
						AND ST_DWithin(
							ST_SetSRID(ST_MakePoint(${countingLocations.longitude}::float, ${countingLocations.latitude}::float), 4326)::geography,
							ps.coordinates::geography,
							30
						)
					)`,
				);
			cycling_counts = countResult[0]?.count || 0;
		} catch (error) {
			console.log("Error counting cycling locations:", error);
			cycling_counts = 0;
		}

		// Check if cycling profile research exists for this street (using static data)
		let cycling_profile = 0;
		try {
			// Check if street name matches any research location
			const streetName = street[0]?.name?.toLowerCase();
			const hasResearch = RESEARCH_LOCATIONS.some((location) => {
				const locationStreet = location.street.toLowerCase();
				return (
					locationStreet.includes(streetName) ||
					streetName.includes(
						locationStreet
							.split(" x ")[0]
							?.replace(/^(rua|avenida|av\.|r\.)\s+/i, "")
							.trim() || "",
					)
				);
			});
			cycling_profile = hasResearch ? 1 : 0;
		} catch (error) {
			console.log("Error checking cycling profile locations:", error);
			cycling_profile = 0;
		}

		// Get emergency calls (accidents) for this street
		let emergency_calls = 0;
		try {
			const emergencyResult = await db
				.select({ count: sql<number>`COUNT(*)` })
				.from(emergencyCalls)
				.where(sql`${emergencyCalls.pcr_address} = ${street[0]?.name}`);
			emergency_calls = emergencyResult[0]?.count || 0;
		} catch (error) {
			console.log("Error counting emergency calls:", error);
			emergency_calls = 0;
		}

		// Note: PDC analysis removed from data-summary due to performance
		// Use /v1/streets/{id}/pdc-analysis for detailed PDC data

		return {
			street_id: streetId,
			street_name: street[0]?.name,
			data_summary: {
				cycling_counts,
				cycling_profile,
				emergency_calls,
			},
		};
	}

	async searchStreets(
		query: string,
		limit: number,
		byLength?: boolean,
		_byElements?: boolean,
	): Promise<StreetMatch[]> {
		try {
			// Try fuzzy search with conditional ordering
			const fuzzyResults = await db
				.select({
					id: pcrStreets.id,
					name: pcrStreets.nlogra_conc,
					length: pcrStreets.db2gse_sde,
					similarity: sql<number>`similarity(${pcrStreets.nlogra_conc}, ${query})`,
				})
				.from(pcrStreets)
				.where(sql`similarity(${pcrStreets.nlogra_conc}, ${query}) > 0.1`)
				.orderBy(
					byLength
						? sql`${pcrStreets.db2gse_sde} DESC, similarity(${pcrStreets.nlogra_conc}, ${query}) DESC`
						: sql`similarity(${pcrStreets.nlogra_conc}, ${query}) DESC`,
				)
				.limit(limit);

			return fuzzyResults.map((row) => ({
				id: row.id.toString(),
				name: row.name,
				confidence: row.similarity,
				municipality: "Recife",
				length: row.length || undefined,
			}));
		} catch {
			// Fallback to ILIKE if pg_trgm not available
			const searchTerm = `%${query.toUpperCase()}%`;

			const likeResults = await db
				.select({
					id: pcrStreets.id,
					name: pcrStreets.nlogra_conc,
					length: pcrStreets.db2gse_sde,
				})
				.from(pcrStreets)
				.where(sql`UPPER(${pcrStreets.nlogra_conc}) LIKE ${searchTerm}`)
				.orderBy(
					byLength
						? sql`${pcrStreets.db2gse_sde} DESC, ${pcrStreets.nlogra_conc}`
						: pcrStreets.nlogra_conc,
				)
				.limit(limit);

			return likeResults.map((row) => ({
				id: row.id.toString(),
				name: row.name,
				confidence: 1.0,
				municipality: "Recife",
				length: row.length || undefined,
			}));
		}
	}

	async getStreetById(streetId: string): Promise<StreetDetails | null> {
		// First get the street name by ID
		const streetName = await db
			.select({ name: pcrStreets.nlogra_conc })
			.from(pcrStreets)
			.where(sql`${pcrStreets.id} = ${parseInt(streetId, 10)}`)
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
		const features = results.map((street) => {
			let geometry: unknown;
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
				},
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
				features,
			},
			properties: {
				totalSegments: results.length,
				totalLength: results.reduce(
					(sum, s) => sum + (s.segmentLength || 0),
					0,
				),
				officialName: firstStreet.officialName,
				resumedName: firstStreet.resumedName,
			},
		};
	}

	async getStreetsByPoint(
		lat: number,
		lng: number,
		buffer: number,
	): Promise<StreetMatch[]> {
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
				)`,
			)
			.limit(50);

		return results.map((row) => ({
			id: row.id.toString(),
			name: row.name,
			confidence: 1.0,
			municipality: "Recife",
		}));
	}
}
