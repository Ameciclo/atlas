import type { InferSelectModel } from "drizzle-orm";
import { OpenAPIHono } from "@hono/zod-openapi";
import { beforeEach, describe, expect, it, vi } from "vitest";
import createApp from "../src/lib/create-app.js";
import locationsRoutes from "../src/routes/locations/locations.index.js";
import type { countingLocations } from "../src/db/schema.js";

type CountingLocation = InferSelectModel<typeof countingLocations>;

// Mock db covering both the query.* API and the chainable select() API used
// by the locations handler and its helper.
const findMany = vi.fn();
const findFirst = vi.fn();
const findManyEvents = vi.fn().mockResolvedValue([]);

const mockDb: any = {
	query: {
		countingLocations: {
			findMany,
			findFirst,
		},
		countingEvents: {
			findMany: findManyEvents,
		},
	},
	select: vi.fn(),
};

const outer = new OpenAPIHono<any>({ strict: false });
outer.use(async (c, next) => {
	c.set("db", mockDb as never);
	await next();
});
const app: any = outer.route(
	"/",
	createApp().route("/v1", locationsRoutes),
);

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

describe("GET /v1/locations", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		findManyEvents.mockResolvedValue([]);
	});

	it("200 → returns all locations when no filter", async () => {
		findMany.mockResolvedValueOnce([mockLocation]);

		const res = await app.request("/v1/locations");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveLength(1);
		expect(data[0]).toMatchObject({
			id: 1,
			name: "Av. Rui Barbosa x R. Amélia",
			city: "Recife",
		});
	});

	it("200 → returns empty array when no locations", async () => {
		findMany.mockResolvedValueOnce([]);

		const res = await app.request("/v1/locations");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("200 → filters by city when provided", async () => {
		findMany.mockResolvedValueOnce([mockLocation]);

		const res = await app.request("/v1/locations?city=Recife");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveLength(1);
		expect(data[0].city).toBe("Recife");
	});
});

describe("GET /v1/locations/:id", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		findManyEvents.mockResolvedValue([]);
	});

	it("200 → returns location when found", async () => {
		findFirst.mockResolvedValueOnce(mockLocation);

		const res = await app.request("/v1/locations/1");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toMatchObject({
			id: 1,
			name: "Av. Rui Barbosa x R. Amélia",
		});
	});

	it("404 → when location not found", async () => {
		findFirst.mockResolvedValueOnce(undefined);

		const res = await app.request("/v1/locations/999");
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Not Found" });
	});
});

describe("GET /v1/locations/nearby", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns nearby locations with counting data", async () => {
		// Mock locations query
		findMany.mockResolvedValueOnce([mockLocation]);

		// Mock counting events aggregation via chainable select()
		mockDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					groupBy: vi.fn().mockResolvedValue([
						{
							location_id: 1,
							total_cyclists: 150,
							years: [2023, 2024],
						},
					]),
				}),
			}),
		});

		const res = await app.request(
			"/v1/locations/nearby?lat=-8.0476&lon=-34.8770&radius=5000",
		);

		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.type).toBe("FeatureCollection");
		expect(data.features).toHaveLength(1);
		expect(data.features[0].properties).toMatchObject({
			name: "Av. Rui Barbosa x R. Amélia",
			city: "Recife",
			total_cyclists: 150,
			years: [2023, 2024],
		});
		expect(data.summary).toMatchObject({
			total_locations: 1,
			total_cyclists: 150,
			by_city: { Recife: 1 },
		});
	});

	it("200 → returns empty collection when no locations nearby", async () => {
		findMany.mockResolvedValueOnce([]);

		mockDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					groupBy: vi.fn().mockResolvedValue([]),
				}),
			}),
		});

		const res = await app.request(
			"/v1/locations/nearby?lat=-8.0476&lon=-34.8770",
		);

		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data.type).toBe("FeatureCollection");
		expect(data.features).toHaveLength(0);
		expect(data.summary.total_locations).toBe(0);
		expect(data.summary.total_cyclists).toBe(0);
	});
});
