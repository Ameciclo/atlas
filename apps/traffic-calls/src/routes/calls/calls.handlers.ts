import { eq, and, gte, lte, ilike } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../../db/index.js";
import { trafficCalls } from "../../db/schema.js";

// ============================================================================
// Handlers
// ============================================================================

export const listCallsHandler = async (c: Context) => {
	try {
		const { start_date, end_date, nature, neighborhood } = c.req.query();

		// Build where conditions
		const conditions = [];
		
		if (start_date) {
			conditions.push(gte(trafficCalls.datetime, new Date(start_date)));
		}
		
		if (end_date) {
			conditions.push(lte(trafficCalls.datetime, new Date(end_date)));
		}
		
		if (nature) {
			conditions.push(ilike(trafficCalls.nature, `%${nature}%`));
		}
		
		if (neighborhood) {
			conditions.push(ilike(trafficCalls.neighborhood, `%${neighborhood}%`));
		}

		// Execute query
		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
		const calls = await db
			.select()
			.from(trafficCalls)
			.where(whereClause)
			.orderBy(trafficCalls.datetime);

		return c.json({
			data: calls,
			total: calls.length,
		});
	} catch (error) {
		console.error("Error listing traffic calls:", error);
		return c.json(
			{
				error: "INTERNAL_ERROR",
				message: "Failed to fetch traffic calls",
			},
			500
		);
	}
};

export const getCallHandler = async (c: Context) => {
	try {
		const { id } = c.req.param();
		const callId = Number(id);

		if (Number.isNaN(callId)) {
			return c.json(
				{
					error: "INVALID_ID",
					message: "Invalid call ID format",
				},
				400
			);
		}

		const call = await db
			.select()
			.from(trafficCalls)
			.where(eq(trafficCalls.id, callId))
			.limit(1);

		if (call.length === 0) {
			return c.json(
				{
					error: "NOT_FOUND",
					message: "Traffic call not found",
				},
				404
			);
		}

		return c.json({
			data: call[0],
		});
	} catch (error) {
		console.error("Error fetching traffic call:", error);
		return c.json(
			{
				error: "INTERNAL_ERROR",
				message: "Failed to fetch traffic call",
			},
			500
		);
	}
};