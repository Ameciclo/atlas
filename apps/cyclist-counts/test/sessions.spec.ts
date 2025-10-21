import type { InferSelectModel } from "drizzle-orm";
import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import type {
	countingEvents,
	countingSessions,
} from "../src/db/schema.js";

type CountingEvent = InferSelectModel<typeof countingEvents>;
type CountingSession = InferSelectModel<typeof countingSessions>;

const client = testClient(app);

const findFirstEvent = vi.spyOn(db.query.countingEvents, "findFirst");
const findManySessions = vi.spyOn(db.query.countingSessions, "findMany");
const findFirstSession = vi.spyOn(db.query.countingSessions, "findFirst");

const mockEvent: CountingEvent = {
	id: 1,
	location_id: 1,
	counting_date: "2023-11-09",
	start_time: "06:00:00",
	end_time: "20:00:00",
	total_cyclists: 3961,
	max_hour_cyclists: 566,
	weather_conditions: null,
	notes: null,
	created_at: new Date("2024-01-01"),
	updated_at: new Date("2024-01-01"),
};

const mockSession1: CountingSession = {
	id: 1,
	event_id: 1,
	session_label: "06-07",
	start_time: new Date("2023-11-09T09:00:00.000Z"),
	end_time: new Date("2023-11-09T10:00:00.000Z"),
	total_cyclists: 351,
	characteristics: {
		women: 26,
		helmet: 15,
		cargo: 90,
		motor: 1,
		ride: 18,
		rain: 0,
		sidewalk: 31,
		wrong_way: 94,
		juveniles: 1,
		service: 0,
		shared_bike: 2,
		other_behaviors: 136,
		other_active_modes: 0,
		others: 0,
	},
	created_at: new Date("2024-01-01"),
	updated_at: new Date("2024-01-01"),
};

const mockSession2: CountingSession = {
	id: 2,
	event_id: 1,
	session_label: "07-08",
	start_time: new Date("2023-11-09T10:00:00.000Z"),
	end_time: new Date("2023-11-09T11:00:00.000Z"),
	total_cyclists: 450,
	characteristics: {
		women: 35,
		helmet: 20,
		cargo: 100,
		motor: 2,
		ride: 25,
		rain: 0,
		sidewalk: 40,
		wrong_way: 100,
		juveniles: 2,
		service: 0,
		shared_bike: 3,
		other_behaviors: 150,
		other_active_modes: 0,
		others: 0,
	},
	created_at: new Date("2024-01-01"),
	updated_at: new Date("2024-01-01"),
};

describe("GET /v1/events/:id/sessions", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns sessions for event when found", async () => {
		findFirstEvent.mockResolvedValueOnce(mockEvent);
		findManySessions.mockResolvedValueOnce([mockSession1, mockSession2]);

		const res = await client.v1.events[":id"].sessions.$get({
			param: { id: 1 },
		});
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveLength(2);
		expect(data[0]).toMatchObject({
			id: 1,
			event_id: 1,
			session_label: "06-07",
			total_cyclists: 351,
		});
		expect(data[0].characteristics).toHaveProperty("women", 26);
		expect(data[1]).toMatchObject({
			id: 2,
			event_id: 1,
			session_label: "07-08",
			total_cyclists: 450,
		});
	});

	it("200 → returns empty array when event has no sessions", async () => {
		findFirstEvent.mockResolvedValueOnce(mockEvent);
		findManySessions.mockResolvedValueOnce([]);

		const res = await client.v1.events[":id"].sessions.$get({
			param: { id: 1 },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("404 → when event not found", async () => {
		findFirstEvent.mockResolvedValueOnce(undefined);

		const res = await client.v1.events[":id"].sessions.$get({
			param: { id: 999 },
		});
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Not Found" });
	});
});

describe("GET /v1/sessions/:id", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns session when found", async () => {
		findFirstSession.mockResolvedValueOnce(mockSession1);

		const res = await client.v1.sessions[":id"].$get({ param: { id: 1 } });
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toMatchObject({
			id: 1,
			event_id: 1,
			session_label: "06-07",
			total_cyclists: 351,
		});
		expect(data.characteristics).toHaveProperty("women", 26);
		expect(data.characteristics).toHaveProperty("helmet", 15);
		expect(data.characteristics).toHaveProperty("cargo", 90);
	});

	it("404 → when session not found", async () => {
		findFirstSession.mockResolvedValueOnce(undefined);

		const res = await client.v1.sessions[":id"].$get({ param: { id: 999 } });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Not Found" });
	});
});

