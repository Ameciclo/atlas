import type { InferSelectModel } from "drizzle-orm";
import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import type { countingEvents, countingLocations } from "../src/db/schema.js";

type CountingEvent = InferSelectModel<typeof countingEvents>;
type CountingLocation = InferSelectModel<typeof countingLocations>;

const client = testClient(app);

const findManyEvents = vi.spyOn(db.query.countingEvents, "findMany");
const findFirstEvent = vi.spyOn(db.query.countingEvents, "findFirst");
const findFirstLocation = vi.spyOn(db.query.countingLocations, "findFirst");

const mockLocation: CountingLocation = {
	id: 1,
	name: "Av. Rui Barbosa x R. Amélia",
	city: "Recife",
	state: "PE",
	latitude: "-8.04511",
	longitude: "-34.90207",
	metadata: {
		ibge_city_id: 2611606,
		state_full: "Pernambuco",
		is_rmr: true,
		directions: {
			north: "Parnamirim",
			east: "Espinheiro",
			south: "Centro",
			west: "Torre",
		},
	},
	created_at: new Date("2024-01-01"),
	updated_at: new Date("2024-01-01"),
};

const mockEvent: CountingEvent = {
	id: 1,
	location_id: 1,
	counting_date: "2023-11-09",
	start_time: "06:00:00",
	end_time: "20:00:00",
	total_cyclists: 3961,
	max_hour_cyclists: 566,
	weather_conditions: {
		temperature: 28,
		condition: "sunny",
	},
	notes: "Normal counting day",
	created_at: new Date("2024-01-01"),
	updated_at: new Date("2024-01-01"),
};

const mockEvent2: CountingEvent = {
	id: 2,
	location_id: 1,
	counting_date: "2023-06-15",
	start_time: "06:00:00",
	end_time: "20:00:00",
	total_cyclists: 2500,
	max_hour_cyclists: 400,
	weather_conditions: null,
	notes: null,
	created_at: new Date("2024-01-01"),
	updated_at: new Date("2024-01-01"),
};

describe("GET /v1/events", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns all events when no filter", async () => {
		findManyEvents.mockResolvedValueOnce([mockEvent, mockEvent2]);

		const res = await client.v1.events.$get({ query: {} });
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveLength(2);
		expect(data[0]).toMatchObject({
			id: 1,
			location_id: 1,
			counting_date: "2023-11-09",
			total_cyclists: 3961,
		});
	});

	it("200 → returns empty array when no events", async () => {
		findManyEvents.mockResolvedValueOnce([]);

		const res = await client.v1.events.$get({ query: {} });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("200 → filters by location_id when provided", async () => {
		findManyEvents.mockResolvedValueOnce([mockEvent]);

		const res = await client.v1.events.$get({ query: { location_id: 1 } });
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveLength(1);
		expect(data[0].location_id).toBe(1);
	});

	it("200 → filters by date range when provided", async () => {
		findManyEvents.mockResolvedValueOnce([mockEvent]);

		const res = await client.v1.events.$get({
			query: {
				start_date: "2023-01-01",
				end_date: "2023-12-31",
			},
		});
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveLength(1);
		expect(data[0].counting_date).toBe("2023-11-09");
	});
});

describe("GET /v1/events/:id", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns event when found", async () => {
		findFirstEvent.mockResolvedValueOnce(mockEvent);

		const res = await client.v1.events[":id"].$get({ param: { id: 1 } });
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toMatchObject({
			id: 1,
			location_id: 1,
			counting_date: "2023-11-09",
			total_cyclists: 3961,
			max_hour_cyclists: 566,
		});
	});

	it("404 → when event not found", async () => {
		findFirstEvent.mockResolvedValueOnce(undefined);

		const res = await client.v1.events[":id"].$get({ param: { id: 999 } });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Not Found" });
	});
});

describe("GET /v1/locations/:id/events", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns events for location when found", async () => {
		findFirstLocation.mockResolvedValueOnce(mockLocation);
		findManyEvents.mockResolvedValueOnce([mockEvent, mockEvent2]);

		const res = await client.v1.locations[":id"].events.$get({
			param: { id: 1 },
		});
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(Array.isArray(data)).toBe(true);
		if (Array.isArray(data)) {
			expect(data).toHaveLength(2);
			expect(data[0].location_id).toBe(1);
			expect(data[1].location_id).toBe(1);
		}
	});

	it("200 → returns empty array when location has no events", async () => {
		findFirstLocation.mockResolvedValueOnce(mockLocation);
		findManyEvents.mockResolvedValueOnce([]);

		const res = await client.v1.locations[":id"].events.$get({
			param: { id: 1 },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("404 → when location not found", async () => {
		findFirstLocation.mockResolvedValueOnce(undefined);

		const res = await client.v1.locations[":id"].events.$get({
			param: { id: 999 },
		});
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Not Found" });
	});
});
