import type { RouteHandler } from "@hono/zod-openapi";
import { sql } from "drizzle-orm";
import type { nearbyRoute } from "./nearby.routes.js";

export const nearbyHandler: RouteHandler<typeof nearbyRoute> = async (c) => {
	const db = c.get("db");
	const { lat, lng, radius } = c.req.valid("query");

	// Raios específicos para cada elemento
	const radiusConfig = {
		bike_racks: radius,
		cyclist_counts: radius * 2, // 2x o raio para contagens
		shared_bike: 2000, // Fixo em 2km para shared bike
		cycling_infra: radius * 1.5, // 1.5x para infraestrutura
		cyclist_profile: radius,
	};

	// 1. Rua mais próxima com informações completas
	const nearestStreet = await db.execute(sql`
		SELECT 
			nlogra_conc,
			nlgpav_ofic,
			ST_Distance(
				ST_Point(${lng}, ${lat})::geography,
				coordinates::geography
			) as distance_meters
		FROM pcr_streets 
		ORDER BY distance_meters
		LIMIT 1
	`);

	const streetInfo = nearestStreet.rows[0];
	const streetName = streetInfo?.nlogra_conc;

	// Calcular extensão total da via pelo nome
	const streetLength = streetName
		? await db.execute(sql`
		SELECT SUM(ST_Length(coordinates::geography)) as total_length
		FROM pcr_streets 
		WHERE nlogra_conc = ${streetName}
	`)
		: { rows: [{ total_length: 0 }] };

	// 2. Emergency calls - histórico anual
	const emergencyHistory = streetName
		? await db.execute(sql`
		SELECT 
			EXTRACT(YEAR FROM date) as year,
			COUNT(*) as total_calls
		FROM emergency_calls 
		WHERE pcr_address ILIKE ${`%${streetName}%`}
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
		WHERE pcr_address ILIKE ${`%${streetName}%`}
		GROUP BY TO_CHAR(date, 'YYYY-MM')
		ORDER BY month DESC
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
		WHERE pcr_address ILIKE ${`%${streetName}%`}
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
		WHERE pcr_address ILIKE ${`%${streetName}%`}
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
		WHERE pcr_address ILIKE ${`%${streetName}%`}
		GROUP BY age_group
		ORDER BY count DESC
	`)
		: { rows: [] };

	// 3. Bike racks próximos
	const bikeRacks = await db.execute(sql`
		SELECT 
			id, name, capacity, bicycle_parking,
			ST_Y(coordinates::geometry) as lat,
			ST_X(coordinates::geometry) as lng,
			ST_Distance(
				ST_Point(${lng}, ${lat})::geography,
				coordinates::geography
			) as distance_meters
		FROM bicycle_racks 
		WHERE ST_DWithin(
			ST_Point(${lng}, ${lat})::geography,
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
				ST_Point(${lng}, ${lat})::geography,
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
			ST_Point(${lng}, ${lat})::geography,
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
				ST_Point(${lng}, ${lat})::geography,
				coordinates::geography
			) as distance_meters
		FROM shared_bike_stations 
		WHERE ST_DWithin(
			ST_Point(${lng}, ${lat})::geography,
			coordinates::geography,
			${radiusConfig.shared_bike}
		)
		ORDER BY distance_meters
		LIMIT 5
	`);

	// 6. Infraestrutura cicloviária existente (agrupada)
	const existingInfra = await db.execute(sql`
		SELECT 
			infra_type as type, 
			COALESCE(name, 'Sem nome') as name,
			MIN(ST_Distance(
				ST_Point(${lng}, ${lat})::geography,
				coordinates::geography
			)) as distance_meters,
			COUNT(*) as segments
		FROM ciclomapa_infra 
		WHERE ST_DWithin(
			ST_Point(${lng}, ${lat})::geography,
			coordinates::geography,
			${radiusConfig.cycling_infra}
		)
		GROUP BY infra_type, COALESCE(name, 'Sem nome')
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
		JOIN pdc_relation_ways prw ON cir.id = prw.relation_id
		WHERE ST_DWithin(
			ST_Point(${lng}, ${lat})::geography,
			coordinates::geography,
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
			ST_Point(${lng}, ${lat})::geography,
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
			ST_Point(${lng}, ${lat})::geography,
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

				// Raça
				if (data.color_race && typeof data.color_race === "string") {
					raceDistribution[data.color_race] =
						(raceDistribution[data.color_race] || 0) + 1;
				}

				// Gênero
				if (data.gender && typeof data.gender === "string") {
					genderDistribution[data.gender] =
						(genderDistribution[data.gender] || 0) + 1;
				}

				// Idade por categoria
				if (data.age_category && typeof data.age_category === "string") {
					ageDistribution[data.age_category] =
						(ageDistribution[data.age_category] || 0) + 1;
				}

				// Educação
				if (data.schooling && typeof data.schooling === "string") {
					educationDistribution[data.schooling] =
						(educationDistribution[data.schooling] || 0) + 1;
				}

				// Renda
				if (data.income_original && typeof data.income_original === "string") {
					incomeDistribution[data.income_original] =
						(incomeDistribution[data.income_original] || 0) + 1;
				}

				// Outros atributos
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
			lat,
			lng,
			nearest_street: streetInfo
				? {
						name: streetInfo.nlogra_conc as string,
						official_name: streetInfo.nlgpav_ofic as string,
						total_length_meters: Math.round(
							Number(streetLength.rows[0]?.total_length) || 0,
						),
						distance_to_point_meters: Math.round(
							Number(streetInfo.distance_meters),
						),
					}
				: null,
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
			by_category: emergencyByCategory.rows.map((row) => ({
				category: row.category as string,
				count: Number(row.count),
			})),
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
	});
};
