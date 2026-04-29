import { Hono } from "hono";

const router = new Hono();

export interface CountEditionCoordinates {
	point: {
		x: number;
		y: number;
	};
	type: string;
	name: string;
}

export interface CountEditionSummary {
	max_hour: number;
	total_cyclists: number;
	total_cargo: number;
	total_helmet: number;
	total_juveniles: number;
	total_motor: number;
	total_ride: number;
	total_service: number;
	total_shared_bike: number;
	total_sidewalk: number;
	total_women: number;
	total_wrong_way: number;
}

// NOTE: This route uses legacy schema that no longer exists in the current database
// It references tables like cyclist_count_edition, cyclist_count_session, direction_count, etc.
// These have been replaced with countingEvents, countingSessions, sessionMovements, etc.
// This route is kept for backward compatibility but should be migrated to use the new schema

router.get("/:id", async (c) => {
	try {
		const editionId = parseInt(c.req.param("id"), 10);
		if (Number.isNaN(editionId)) {
			return c.json({ error: "Invalid edition ID" }, 400);
		}

		// This route references legacy database schema that no longer exists
		// The tables cyclist_count_edition, cyclist_count_session, direction_count, etc.
		// have been replaced with countingEvents, countingSessions, sessionMovements, etc.
		return c.json(
			{
				error:
					"This endpoint uses legacy database schema that no longer exists. Use /v1/events/:id/details instead.",
				deprecated: true,
				legacy_schema: true,
			},
			410,
		);
	} catch (error) {
		console.error("Error fetching edition data:", error);
		return c.json({ error: "Internal Server Error" }, 500);
	}
});

export default router;
