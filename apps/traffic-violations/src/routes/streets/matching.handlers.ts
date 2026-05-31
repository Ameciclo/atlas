import { count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { locationStreetMatches, streetCodes } from "../../db/schema.js";
import type { MatchInput } from "../../lib/match-orchestrator.js";
import {
	batchMatchLocations,
	computeMatchStats,
	matchLocation,
} from "../../lib/match-orchestrator.js";
import type { StreetRecord } from "../../lib/street-matcher.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type {
	batchMatchRoute,
	confirmValidationRoute,
	listValidationsRoute,
	matchLocationRoute,
	matchStatsRoute,
	rejectValidationRoute,
} from "./matching.routes.js";

async function loadStreets(): Promise<StreetRecord[]> {
	const streets = await db
		.select({
			code: streetCodes.code,
			nameConcatenated: streetCodes.name_concatenated,
			officialName: streetCodes.official_name,
			shortName: streetCodes.short_name,
		})
		.from(streetCodes);

	return streets;
}

export const matchLocationHandler: AppRouteHandler<
	typeof matchLocationRoute
> = async (c) => {
	const body = c.req.valid("json");

	try {
		const streets = await loadStreets();
		const input: MatchInput = {
			locationId: body.location_id,
			locationDescription: body.location_description,
			csvStreetCode: body.csv_street_code ?? null,
			latitude: body.latitude ?? null,
			longitude: body.longitude ?? null,
			neighborhoodHint: body.neighborhood_hint ?? null,
		};

		const output = matchLocation(input, {
			streets,
			autoAcceptThreshold: 0.85,
			validationThreshold: 0.5,
		});

		const candidates = output.result.candidates.map((c) => ({
			street_code: c.street.code,
			official_name: c.street.officialName,
			short_name: c.street.shortName || null,
			score: Math.round(c.score * 1000) / 1000,
			method: c.method,
		}));

		return c.json(
			{
				location_id: output.locationId,
				matched: output.result.matched,
				confidence: output.result.confidence,
				method: output.result.method,
				needs_validation: output.needsValidation,
				candidates,
				normalized: output.normalized,
			},
			200,
		) as any;
	} catch (error) {
		console.error("Error matching location:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const batchMatchHandler: AppRouteHandler<
	typeof batchMatchRoute
> = async (c) => {
	const body = c.req.valid("json");

	try {
		const streets = await loadStreets();
		const inputs: MatchInput[] = body.locations.map((loc) => ({
			locationId: loc.location_id,
			locationDescription: loc.location_description,
			csvStreetCode: loc.csv_street_code ?? null,
			latitude: loc.latitude ?? null,
			longitude: loc.longitude ?? null,
			neighborhoodHint: loc.neighborhood_hint ?? null,
		}));

		const outputs = batchMatchLocations(inputs, {
			streets,
			autoAcceptThreshold: 0.85,
			validationThreshold: 0.5,
		});
		const stats = computeMatchStats(outputs);

		const results = outputs.map((output) => {
			const candidates = output.result.candidates.map((c) => ({
				street_code: c.street.code,
				official_name: c.street.officialName,
				short_name: c.street.shortName || null,
				score: Math.round(c.score * 1000) / 1000,
				method: c.method,
			}));

			return {
				location_id: output.locationId,
				matched: output.result.matched,
				confidence: output.result.confidence,
				method: output.result.method,
				needs_validation: output.needsValidation,
				candidates,
			};
		});

		return c.json(
			{
				results,
				stats: {
					total: stats.total,
					matched: stats.matched,
					unmatched: stats.unmatched,
					auto_accepted: stats.autoAccepted,
					needs_validation: stats.needsValidation,
					by_method: stats.byMethod,
					avg_confidence: stats.avgConfidence,
				},
			},
			200,
		) as any;
	} catch (error) {
		console.error("Error in batch match:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const matchStatsHandler: AppRouteHandler<
	typeof matchStatsRoute
> = async (c) => {
	try {
		const [totalMatched] = await db
			.select({ count: count() })
			.from(locationStreetMatches)
			.where(isNotNull(locationStreetMatches.matched_street_code));

		const [totalPending] = await db
			.select({ count: count() })
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.needs_validation, true));

		const byMethod = await db
			.select({
				method: locationStreetMatches.match_method,
				count: count(),
			})
			.from(locationStreetMatches)
			.where(isNotNull(locationStreetMatches.match_method))
			.groupBy(locationStreetMatches.match_method);

		const [confirmed] = await db
			.select({ count: count() })
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.validation_status, "confirmed"));

		const [rejected] = await db
			.select({ count: count() })
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.validation_status, "rejected"));

		const [pendingValidations] = await db
			.select({ count: count() })
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.validation_status, "pending"));

		const byMethodMap: Record<string, number> = {};
		for (const row of byMethod) {
			if (row.method) {
				byMethodMap[row.method] = row.count;
			}
		}

		return c.json(
			{
				total_locations_matched: totalMatched?.count || 0,
				total_locations_pending: totalPending?.count || 0,
				total_auto_accepted:
					(totalMatched?.count || 0) - (totalPending?.count || 0),
				by_method: byMethodMap,
				validation_queue: {
					pending: pendingValidations?.count || 0,
					confirmed: confirmed?.count || 0,
					rejected: rejected?.count || 0,
				},
			},
			200,
		) as any;
	} catch (error) {
		console.error("Error fetching match stats:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const listValidationsHandler: AppRouteHandler<
	typeof listValidationsRoute
> = async (c) => {
	const { page, limit } = c.req.valid("query");
	const offset = (page - 1) * limit;

	try {
		const [totalResult] = await db
			.select({ count: count() })
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.needs_validation, true));

		const total = totalResult?.count || 0;
		const totalPages = Math.ceil(total / limit);

		const matches = await db
			.select({
				id: locationStreetMatches.id,
				location_id: locationStreetMatches.location_id,
				location_description: locationStreetMatches.location_description,
				extracted_street_name: locationStreetMatches.extracted_street_name,
				match_confidence: locationStreetMatches.match_confidence,
				match_method: locationStreetMatches.match_method,
				validation_status: locationStreetMatches.validation_status,
				alternative_candidates: locationStreetMatches.alternative_candidates,
				normalized_data: locationStreetMatches.normalized_data,
				created_at: sql<string>`${locationStreetMatches.created_at}::text`,
			})
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.needs_validation, true))
			.orderBy(desc(locationStreetMatches.match_confidence))
			.limit(limit)
			.offset(offset);

		const data = matches.map((m) => ({
			id: m.id,
			location_id: m.location_id,
			location_description: m.location_description,
			extracted_street_name: m.extracted_street_name,
			match_confidence: m.match_confidence ? Number(m.match_confidence) : null,
			match_method: m.match_method,
			validation_status: m.validation_status,
			candidates: m.alternative_candidates,
			normalized: m.normalized_data,
			created_at: m.created_at,
		}));

		return c.json(
			{
				data,
				pagination: { page, limit, total, totalPages },
			},
			200,
		) as any;
	} catch (error) {
		console.error("Error listing validations:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const confirmValidationHandler: AppRouteHandler<
	typeof confirmValidationRoute
> = async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");

	try {
		const [existing] = await db
			.select()
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.id, id))
			.limit(1);

		if (!existing) {
			return c.json({ error: "Match record not found" }, 404);
		}

		await db
			.update(locationStreetMatches)
			.set({
				validation_status: "confirmed",
				validated_by: body.validated_by,
				validated_at: new Date(),
				needs_validation: false,
			})
			.where(eq(locationStreetMatches.id, id));

		return c.json(
			{ success: true, message: "Match confirmed successfully" },
			200,
		);
	} catch (error) {
		console.error("Error confirming validation:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};

export const rejectValidationHandler: AppRouteHandler<
	typeof rejectValidationRoute
> = async (c) => {
	const { id } = c.req.valid("param");
	const body = c.req.valid("json");

	try {
		const [existing] = await db
			.select()
			.from(locationStreetMatches)
			.where(eq(locationStreetMatches.id, id))
			.limit(1);

		if (!existing) {
			return c.json({ error: "Match record not found" }, 404);
		}

		await db
			.update(locationStreetMatches)
			.set({
				validation_status: "rejected",
				validated_by: body.validated_by,
				validated_at: new Date(),
				needs_validation: false,
				matched_street_code:
					body.corrected_street_code ?? existing.matched_street_code,
			})
			.where(eq(locationStreetMatches.id, id));

		return c.json({ success: true, message: "Match rejected" }, 200);
	} catch (error) {
		console.error("Error rejecting validation:", error);
		return c.json({ error: "Internal server error" }, 500);
	}
};
