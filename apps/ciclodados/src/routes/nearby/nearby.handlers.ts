import type { RouteHandler } from "@hono/zod-openapi";
import { HTTPException } from "hono/http-exception";
import { sql } from "drizzle-orm";
import { normalizeCategory } from "@atlas/database/schemas/emergency-calls/categories";
import { db } from "../../lib/database.js";
import type { nearbyRoute } from "./nearby.routes.js";

export const nearbyHandler: RouteHandler<typeof nearbyRoute> = async (c) => {
	const { lat, lng, radius, street: streetId, ticket_limit: ticketLimit } =
		c.req.valid("query");

	// Raio efetivo: 200m padrão quando há ponto GPS, 10m para modo rua puro
	const hasPoint = lat !== undefined && lng !== undefined;
	const effectiveRadius = radius ?? (hasPoint ? 200 : 10);

	// Raios específicos para cada elemento
	const radiusConfig = {
		bike_racks: effectiveRadius * 1,
		cyclist_counts: effectiveRadius * 2,
		shared_bike: 2000,
		cycling_infra: effectiveRadius * 1.5,
		cyclist_profile: effectiveRadius * 1,
	};

	// ── Referência espacial: ponto GPS OU geometria da rua ──
	let refGeo: ReturnType<typeof sql>;
	let streetName: string | null = null;
	let clograCodi: number | null = null;
	let nearestStreetInfo: Record<string, unknown> | null = null;
	let nearbyStreetsData: Record<string, unknown>[] = [];
	let responseLat: number;
	let responseLng: number;

	if (streetId) {
		const streetData = await db.execute(sql`
			SELECT nlogra_conc, nlgpav_ofic, clogra_codi, coordinates
			FROM pcr_streets WHERE id = ${streetId}
		`);

		if (streetData.rows.length === 0) {
			throw new HTTPException(404, { message: "Street not found" });
		}

		const s = streetData.rows[0]!;
		streetName = s.nlogra_conc as string;
		clograCodi = s.clogra_codi as number;

		if (hasPoint) {
			refGeo = sql`ST_Point(${lng}, ${lat})::geography`;
			responseLat = lat!;
			responseLng = lng!;

			nearestStreetInfo = {
				id: Number(streetId),
				nlogra_conc: s.nlogra_conc,
				nlgpav_ofic: s.nlgpav_ofic,
				clogra_codi: clograCodi,
				distance_meters: 0,
			};
		} else {
			refGeo = sql`(SELECT coordinates::geography FROM pcr_streets WHERE id = ${streetId})`;

			const centroid = await db.execute(sql`
				SELECT ST_Y(ST_Centroid(coordinates::geometry)) as lat,
				       ST_X(ST_Centroid(coordinates::geometry)) as lng
				FROM pcr_streets WHERE id = ${streetId}
			`);
			responseLat = Number(centroid.rows[0]?.lat) || 0;
			responseLng = Number(centroid.rows[0]?.lng) || 0;

			nearestStreetInfo = {
				id: Number(streetId),
				nlogra_conc: s.nlogra_conc,
				nlgpav_ofic: s.nlgpav_ofic,
				clogra_codi: clograCodi,
				distance_meters: 0,
			};
		}

		const nearbyStreetRows = await db.execute(sql`
			SELECT id, nlogra_conc, nlgpav_ofic, clogra_codi, distance_meters
			FROM (
				SELECT
					ps.id,
					ps.nlogra_conc,
					ps.nlgpav_ofic,
					ps.clogra_codi,
					ST_Distance(${refGeo}, ps.coordinates::geography) as distance_meters,
					ROW_NUMBER() OVER (
						PARTITION BY ps.clogra_codi
						ORDER BY ST_Distance(${refGeo}, ps.coordinates::geography)
					) as rn
				FROM pcr_streets ps
				WHERE ST_DWithin(${refGeo}, ps.coordinates::geography, ${effectiveRadius})
			) sub
			WHERE rn = 1
			ORDER BY distance_meters
			LIMIT 5
		`);
		nearbyStreetsData = nearbyStreetRows.rows.filter(
			(row) => Number(row.id) !== Number(streetId),
		);
	} else {
		refGeo = sql`ST_Point(${lng}, ${lat})::geography`;
		responseLat = lat!;
		responseLng = lng!;

		const nearbyStreetRows = await db.execute(sql`
			SELECT id, nlogra_conc, nlgpav_ofic, clogra_codi, distance_meters
			FROM (
				SELECT
					ps.id,
					ps.nlogra_conc,
					ps.nlgpav_ofic,
					ps.clogra_codi,
					ST_Distance(${refGeo}, ps.coordinates::geography) as distance_meters,
					ROW_NUMBER() OVER (
						PARTITION BY ps.clogra_codi
						ORDER BY ST_Distance(${refGeo}, ps.coordinates::geography)
					) as rn
				FROM pcr_streets ps
				WHERE ST_DWithin(${refGeo}, ps.coordinates::geography, ${effectiveRadius})
			) sub
			WHERE rn = 1
			ORDER BY distance_meters
			LIMIT 5
		`);

		const first = nearbyStreetRows.rows[0] as Record<string, unknown> | undefined;
		streetName = first?.nlogra_conc as string | null;
		clograCodi = first?.clogra_codi as number | null;
		nearestStreetInfo = first ?? null;
		nearbyStreetsData = nearbyStreetRows.rows.slice(1);
	}

	// Calcular extensão total da via pelo nome (ambos modos)
	let streetTotalLength = 0;
	if (streetName) {
		const lenRes = await db.execute(sql`
			SELECT SUM(ST_Length(coordinates::geography)) as total_length
			FROM pcr_streets WHERE nlogra_conc = ${streetName}
		`);
		streetTotalLength = Math.round(
			Number(lenRes.rows[0]?.total_length) || 0,
		);
	}

	// 2. Emergency calls - histórico anual (via FK pcr_street_id)
	const emergencyHistory = streetName
		? await db.execute(sql`
		SELECT
			EXTRACT(YEAR FROM date) as year,
			COUNT(*) as total_calls
		FROM emergency_calls
		WHERE pcr_street_id IN (
			SELECT id FROM pcr_streets WHERE nlogra_conc = ${streetName}
		)
		GROUP BY EXTRACT(YEAR FROM date)
		ORDER BY year DESC
	`)
		: { rows: [] };

	// 2.1. Último mês com dados
	const lastMonthData = streetName
		? await db.execute(sql`
		SELECT
			TO_CHAR(date, 'YYYY-MM') as month,
			COUNT(*) as total_calls
		FROM emergency_calls
		WHERE pcr_street_id IN (
			SELECT id FROM pcr_streets WHERE nlogra_conc = ${streetName}
		)
		GROUP BY TO_CHAR(date, 'YYYY-MM')
		ORDER BY month DESC
		LIMIT 1
	`)
		: { rows: [] };

	// 2.1.1 Primeiro mês com dados
	const firstMonthData = streetName
		? await db.execute(sql`
		SELECT
			TO_CHAR(date, 'YYYY-MM') as month,
			COUNT(*) as total_calls
		FROM emergency_calls
		WHERE pcr_street_id IN (
			SELECT id FROM pcr_streets WHERE nlogra_conc = ${streetName}
		)
		GROUP BY TO_CHAR(date, 'YYYY-MM')
		ORDER BY month ASC
		LIMIT 1
	`)
		: { rows: [] };

	// 2.2. Por categoria
	const emergencyByCategory = streetName
		? await db.execute(sql`
		SELECT
			COALESCE(category, 'Não informado') as category,
			COUNT(*) as count
		FROM emergency_calls
		WHERE pcr_street_id IN (
			SELECT id FROM pcr_streets WHERE nlogra_conc = ${streetName}
		)
		GROUP BY category
		ORDER BY count DESC
		LIMIT 10
	`)
		: { rows: [] };

	// 2.3. Por gênero
	const emergencyByGender = streetName
		? await db.execute(sql`
		SELECT
			gender,
			COUNT(*) as count
		FROM emergency_calls
		WHERE pcr_street_id IN (
			SELECT id FROM pcr_streets WHERE nlogra_conc = ${streetName}
		)
		GROUP BY gender
		ORDER BY count DESC
	`)
		: { rows: [] };

	// 2.4. Por faixa etária
	const emergencyByAge = streetName
		? await db.execute(sql`
		SELECT
			CASE
				WHEN age < 18 THEN 'Menor de 18'
				WHEN age BETWEEN 18 AND 30 THEN '18-30'
				WHEN age BETWEEN 31 AND 50 THEN '31-50'
				WHEN age BETWEEN 51 AND 70 THEN '51-70'
				WHEN age > 70 THEN 'Maior de 70'
				ELSE 'Não informado'
			END as age_group,
			COUNT(*) as count
		FROM emergency_calls
		WHERE pcr_street_id IN (
			SELECT id FROM pcr_streets WHERE nlogra_conc = ${streetName}
		)
		GROUP BY age_group
		ORDER BY count DESC
	`)
		: { rows: [] };

	// 2.5. Traffic tickets — totais por ano (via MV indexada em street_code)
	const trafficByYear = clograCodi
		? await db.execute(sql`
		SELECT year, SUM(count)::int as total
		FROM tv_mvs.mv_spatial
		WHERE street_code = ${clograCodi}
		GROUP BY year
		ORDER BY year DESC
	`)
		: { rows: [] };

	// 2.5.1 Traffic tickets — último mês com dados
	const lastMonthTickets = clograCodi
		? await db.execute(sql`
		SELECT year, month, SUM(count)::int as total
		FROM tv_mvs.mv_spatial
		WHERE street_code = ${clograCodi}
		GROUP BY year, month
		ORDER BY year DESC, month DESC
		LIMIT 1
	`)
		: { rows: [] };

	// 2.5.2 Traffic tickets — primeiro mês com dados
	const firstMonthTickets = clograCodi
		? await db.execute(sql`
		SELECT year, month, SUM(count)::int as total
		FROM tv_mvs.mv_spatial
		WHERE street_code = ${clograCodi}
		GROUP BY year, month
		ORDER BY year ASC, month ASC
		LIMIT 1
	`)
		: { rows: [] };

	// 2.6. Traffic tickets — top violações por rua
	const topViolations = clograCodi
		? db.execute(sql`
		SELECT * FROM (
			SELECT mv.law_code,
				   MAX(mv.canonical_description) as description,
				   COUNT(*)::int as count,
				   ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage,
				   ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC) as rn
			FROM tv_mvs.violations_joined mv
			WHERE mv.street_code = ${clograCodi}
			GROUP BY mv.law_code
		) sub WHERE rn <= ${ticketLimit}
		ORDER BY rn
	`)
		: null;

	// 2.7. Traffic tickets — infrações contra ciclistas (distância lateral, estacionar em ciclovia, etc.)
	const vulnerableViolations = clograCodi
		? db.execute(sql`
		SELECT mv.law_code,
			   MAX(mv.canonical_description) as description,
			   COUNT(*)::int as count
		FROM tv_mvs.violations_joined mv
		WHERE mv.street_code = ${clograCodi}
		  AND mv.law_code IN (
			'Art. 201',
			'Art. 181, Inc. VIII',
			'Art. 182, Inc. XI',
			'Art. 193',
			'Art. 220, Inc. XIII'
		  )
		GROUP BY mv.law_code
		ORDER BY count DESC
	`)
		: null;

	// Wait for both async queries
	const [topViolationsRes, vulnerableViolationsRes] = await Promise.all([
		topViolations,
		vulnerableViolations,
	]);

	// 3. Bike racks próximos
	const bikeRacks = await db.execute(sql`
		SELECT
			id, name, capacity, bicycle_parking,
			ST_Y(coordinates::geometry) as lat,
			ST_X(coordinates::geometry) as lng,
			ST_Distance(
				${refGeo},
				coordinates::geography
			) as distance_meters
		FROM bicycle_racks
		WHERE ST_DWithin(
			${refGeo},
			coordinates::geography,
			${radiusConfig.bike_racks}
		)
		ORDER BY distance_meters
		LIMIT 10
	`);

	// 4. Contagens de ciclistas próximas
	const cyclistCounts = await db.execute(sql`
		SELECT
			ce.id,
			cl.name,
			ce.counting_date as date,
			cl.city,
			ce.total_cyclists,
			ST_Distance(
				${refGeo},
				ST_Point(cl.longitude::float, cl.latitude::float)::geography
			) as distance_meters,
			SUM(COALESCE((cs.characteristics->>'cargo')::int, 0)) as total_cargo,
			SUM(COALESCE((cs.characteristics->>'helmet')::int, 0)) as total_helmet,
			SUM(COALESCE((cs.characteristics->>'juveniles')::int, 0)) as total_juveniles,
			SUM(COALESCE((cs.characteristics->>'motor')::int, 0)) as total_motor,
			SUM(COALESCE((cs.characteristics->>'ride')::int, 0)) as total_ride,
			SUM(COALESCE((cs.characteristics->>'service')::int, 0)) as total_service,
			SUM(COALESCE((cs.characteristics->>'shared_bike')::int, 0)) as total_shared_bike,
			SUM(COALESCE((cs.characteristics->>'sidewalk')::int, 0)) as total_sidewalk,
			SUM(COALESCE((cs.characteristics->>'women')::int, 0)) as total_women,
			SUM(COALESCE((cs.characteristics->>'wrong_way')::int, 0)) as total_wrong_way
		FROM counting_events ce
		JOIN counting_locations cl ON ce.location_id = cl.id
		LEFT JOIN counting_sessions cs ON cs.event_id = ce.id
		WHERE ST_DWithin(
			${refGeo},
			ST_Point(cl.longitude::float, cl.latitude::float)::geography,
			${radiusConfig.cyclist_counts}
		)
		GROUP BY ce.id, cl.name, ce.counting_date, cl.city, ce.total_cyclists, cl.longitude, cl.latitude
		ORDER BY distance_meters
		LIMIT 5
	`);

	// 5. Shared bike stations próximas
	const sharedBikeStations = await db.execute(sql`
		SELECT
			id, name, capacity,
			ST_Distance(
				${refGeo},
				coordinates::geography
			) as distance_meters
		FROM shared_bike_stations
		WHERE ST_DWithin(
			${refGeo},
			coordinates::geography,
			${radiusConfig.shared_bike}
		)
		ORDER BY distance_meters
		LIMIT 5
	`);

	// 6. Infraestrutura cicloviária existente (agrupada)
	const existingInfra = await db.execute(sql`
		WITH parsed_ways AS (
			SELECT
				prw.osm_properties,
				prw.name,
				ST_GeomFromGeoJSON(prw.geojson#>'{features,0,geometry}')::geography as way_geography
			FROM pdc_relation_ways prw
			WHERE prw.geojson#>'{features,0,geometry}' IS NOT NULL
		)
		SELECT
			osm_properties->>'cycleway_typology' as type,
			COALESCE(name, 'Sem nome') as name,
			MIN(ST_Distance(
				${refGeo},
				way_geography
			)) as distance_meters,
			COUNT(*) as segments
		FROM parsed_ways
		WHERE (osm_properties->>'has_cycleway')::boolean = true
		  AND ST_DWithin(
			${refGeo},
			way_geography,
			${radiusConfig.cycling_infra}
		)
		GROUP BY osm_properties->>'cycleway_typology', COALESCE(name, 'Sem nome')
		ORDER BY distance_meters
		LIMIT 5
	`);

	// 7. Infraestrutura planejada PDC próxima
	const plannedInfra = await db.execute(sql`
		SELECT DISTINCT
			cir.id,
			cir.pdc_ref,
			cir.pdc_typology as typology,
			cir.name,
			cir.pdc_stretch,
			cir.pdc_cities,
			cir.pdc_km
		FROM cyclist_infra_relations cir
		JOIN pdc_relation_ways prw
			ON cir.id = prw.relation_id
			AND prw.geojson#>'{features,0,geometry}' IS NOT NULL
		WHERE ST_DWithin(
			${refGeo},
			ST_GeomFromGeoJSON(prw.geojson#>'{features,0,geometry}')::geography,
			${radiusConfig.cycling_infra}
		) AND cir.pdc_ref IS NOT NULL
		LIMIT 5
	`);

	// 8. Perfil ciclista por edição
	const cyclistProfiles = await db.execute(sql`
		SELECT
			data,
			metadata
		FROM cyclist_profiles
		WHERE ST_DWithin(
			${refGeo},
			coordinates::geography,
			${radiusConfig.cyclist_profile}
		)
		ORDER BY metadata->>'edition' DESC
	`);

	// Total de perfis na área
	const totalProfiles = await db.execute(sql`
		SELECT COUNT(*) as total
		FROM cyclist_profiles
		WHERE ST_DWithin(
			${refGeo},
			coordinates::geography,
			${radiusConfig.cyclist_profile}
		)
	`);

	// Processar dados
	const totalCapacity = bikeRacks.rows.reduce(
		(sum, row) => sum + (Number(row.capacity) || 0),
		0,
	);

	// Processar perfis por edição (ano da pesquisa)
	const editionsMap = new Map<string, unknown[]>();
	for (const row of cyclistProfiles.rows) {
		const metadata = row.metadata as Record<string, unknown>;
		const edition = metadata?.survey_year
			? metadata.survey_year.toString()
			: "Sem ano";
		if (!editionsMap.has(edition)) {
			editionsMap.set(edition, []);
		}
		editionsMap.get(edition)?.push(row.data);
	}

	const editionsData = Array.from(editionsMap.entries()).map(
		([edition, profiles]) => {
			const raceDistribution: Record<string, number> = {};
			const genderDistribution: Record<string, number> = {};
			const ageDistribution: Record<string, number> = {};
			const educationDistribution: Record<string, number> = {};
			const incomeDistribution: Record<string, number> = {};
			const otherAttributes: Record<string, number> = {};

			for (const profile of profiles) {
				const data = profile as Record<string, unknown>;

				if (data.color_race && typeof data.color_race === "string") {
					raceDistribution[data.color_race] =
						(raceDistribution[data.color_race] || 0) + 1;
				}

				if (data.gender && typeof data.gender === "string") {
					genderDistribution[data.gender] =
						(genderDistribution[data.gender] || 0) + 1;
				}

				if (data.age_category && typeof data.age_category === "string") {
					ageDistribution[data.age_category] =
						(ageDistribution[data.age_category] || 0) + 1;
				}

				if (data.schooling && typeof data.schooling === "string") {
					educationDistribution[data.schooling] =
						(educationDistribution[data.schooling] || 0) + 1;
				}

				if (data.income_original && typeof data.income_original === "string") {
					incomeDistribution[data.income_original] =
						(incomeDistribution[data.income_original] || 0) + 1;
				}

				for (const [key, value] of Object.entries(data)) {
					if (
						![
							"color_race",
							"gender",
							"age_category",
							"schooling",
							"income_original",
						].includes(key) &&
						value &&
						typeof value === "string"
					) {
						const attrKey = `${key}: ${value}`;
						otherAttributes[attrKey] = (otherAttributes[attrKey] || 0) + 1;
					}
				}
			}

			return {
				edition,
				total_profiles: profiles.length,
				race_distribution: raceDistribution,
				gender_distribution: genderDistribution,
				age_distribution: ageDistribution,
				education_distribution: educationDistribution,
				income_distribution: incomeDistribution,
				other_attributes: otherAttributes,
			};
		},
	);

	return c.json({
		location: {
			lat: responseLat,
			lng: responseLng,
			nearest_street: nearestStreetInfo
				? {
						id: Number(nearestStreetInfo.id),
						name: nearestStreetInfo.nlogra_conc as string,
						official_name: nearestStreetInfo.nlgpav_ofic as string,
						clogra_codi: nearestStreetInfo.clogra_codi as number,
						total_length_meters: streetTotalLength,
						distance_to_point_meters: Math.round(
							Number(nearestStreetInfo.distance_meters),
						),
					}
				: null,
			nearby_streets: nearbyStreetsData.map((row) => ({
				id: Number(row.id),
				clogra_codi: Number(row.clogra_codi),
				name: row.nlogra_conc as string,
				official_name: row.nlgpav_ofic as string,
				distance_meters: Math.round(Number(row.distance_meters)),
			})),
		},
		emergency_calls: {
			annual_history: emergencyHistory.rows.map((row) => ({
				year: Number(row.year),
				total_calls: Number(row.total_calls),
			})),
			last_month_data: lastMonthData.rows[0]
				? {
						month: lastMonthData.rows[0].month as string,
						total_calls: Number(lastMonthData.rows[0].total_calls),
					}
				: null,
			first_month_data: firstMonthData.rows[0]
				? {
						month: firstMonthData.rows[0].month as string,
						total_calls: Number(firstMonthData.rows[0].total_calls),
					}
				: null,
			by_category: Object.entries(
				(emergencyByCategory.rows as Record<string, unknown>[]).reduce<
					Record<string, number>
				>(
					(acc, row) => {
						const bucket = normalizeCategory(
							row.category as string | null,
						);
						acc[bucket] = (acc[bucket] || 0) + Number(row.count);
						return acc;
					},
					{},
				),
			)
				.map(([category, count]) => ({ category, count }))
				.sort((a, b) => b.count - a.count),
			by_gender: emergencyByGender.rows.map((row) => ({
				gender: row.gender as string | null,
				count: Number(row.count),
			})),
			by_age_group: emergencyByAge.rows.map((row) => ({
				age_group: row.age_group as string,
				count: Number(row.count),
			})),
		},
		bike_racks: {
			total: bikeRacks.rows.length,
			total_capacity: totalCapacity,
			items: bikeRacks.rows.map((row) => ({
				id: Number(row.id),
				name: row.name as string | null,
				capacity: row.capacity as string | null,
				type: row.bicycle_parking as string | null,
				lat: Number(row.lat),
				lng: Number(row.lng),
				distance_meters: Math.round(Number(row.distance_meters)),
			})),
		},
		cyclist_counts: {
			counts: cyclistCounts.rows.map((row) => ({
				id: Number(row.id),
				name: row.name as string,
				date: row.date as string,
				city: row.city as string,
				total_cyclists: Number(row.total_cyclists),
				distance_meters: Math.round(Number(row.distance_meters)),
				characteristics: {
					cargo: Number(row.total_cargo) || 0,
					helmet: Number(row.total_helmet) || 0,
					juveniles: Number(row.total_juveniles) || 0,
					motor: Number(row.total_motor) || 0,
					ride: Number(row.total_ride) || 0,
					service: Number(row.total_service) || 0,
					shared_bike: Number(row.total_shared_bike) || 0,
					sidewalk: Number(row.total_sidewalk) || 0,
					women: Number(row.total_women) || 0,
					wrong_way: Number(row.total_wrong_way) || 0,
				},
			})),
		},
		shared_bike: {
			has_stations: sharedBikeStations.rows.length > 0,
			stations: sharedBikeStations.rows.map((row) => ({
				id: Number(row.id),
				name: row.name as string,
				capacity: Number(row.capacity),
				distance_meters: Math.round(Number(row.distance_meters)),
			})),
		},
		cycling_infra: {
			existing: existingInfra.rows.map((row) => ({
				type: row.type as string,
				name: row.name as string | null,
				distance_meters: Math.round(Number(row.distance_meters)),
			})),
			planned_pdc: plannedInfra.rows.map((row) => ({
				id: Number(row.id),
				pdc_ref: row.pdc_ref as string,
				typology: row.typology as string,
				name: row.name as string | null,
				pdc_stretch: row.pdc_stretch as string | null,
				pdc_cities: row.pdc_cities as string | null,
				pdc_km: row.pdc_km ? Number(row.pdc_km) : null,
			})),
		},
		cyclist_profile: {
			total_profiles: Number(totalProfiles.rows[0]?.total) || 0,
			by_edition: editionsData,
		},
		traffic_tickets: {
			total_violations: trafficByYear.rows.reduce(
				(sum, row) => sum + (Number(row.total) || 0),
				0,
			),
			last_month_data: lastMonthTickets.rows[0]
				? {
						month: `${lastMonthTickets.rows[0].year}-${String(lastMonthTickets.rows[0].month).padStart(2, "0")}`,
						total: Number(lastMonthTickets.rows[0].total),
					}
				: null,
			first_month_data: firstMonthTickets.rows[0]
				? {
						month: `${firstMonthTickets.rows[0].year}-${String(firstMonthTickets.rows[0].month).padStart(2, "0")}`,
						total: Number(firstMonthTickets.rows[0].total),
					}
				: null,
			by_year: trafficByYear.rows.map((row) => ({
				year: Number(row.year),
				total: Number(row.total),
			})),
			top_violations: (topViolationsRes?.rows ?? []).map((row) => ({
				law_code: row.law_code as string,
				description: row.description as string,
				count: Number(row.count),
				percentage: Number(row.percentage),
			})),
			vulnerable_violations: (vulnerableViolationsRes?.rows ?? []).map(
				(row) => ({
					law_code: row.law_code as string,
					description: row.description as string,
					count: Number(row.count),
				}),
			),
		},
	});
};
