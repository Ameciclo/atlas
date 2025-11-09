import type { InferSelectModel } from "drizzle-orm";
import { testClient } from "hono/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import type { countingLocations } from "../src/db/schema.js";

type CountingLocation = InferSelectModel<typeof countingLocations>;

const client = testClient(app);

const findMany = vi.spyOn(db.query.countingLocations, "findMany");
const findFirst = vi.spyOn(db.query.countingLocations, "findFirst");

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
	});

	it("200 → returns all locations when no filter", async () => {
		findMany.mockResolvedValueOnce([mockLocation]);

		const res = await client.v1.locations.$get();
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

		const res = await client.v1.locations.$get();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("200 → filters by city when provided", async () => {
		findMany.mockResolvedValueOnce([mockLocation]);

		const res = await client.v1.locations.$get({ query: { city: "Recife" } });
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveLength(1);
		expect(data[0].city).toBe("Recife");
	});
});

describe("GET /v1/locations/:id", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns location when found", async () => {
		findFirst.mockResolvedValueOnce(mockLocation);

		const res = await client.v1.locations[":id"].$get({ param: { id: 1 } });
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toMatchObject({
			id: 1,
			name: "Av. Rui Barbosa x R. Amélia",
		});
	});

	it("404 → when location not found", async () => {
		findFirst.mockResolvedValueOnce(undefined);

		const res = await client.v1.locations[":id"].$get({ param: { id: 999 } });
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
		
		// Mock counting events query
		const mockSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					groupBy: vi.fn().mockResolvedValue([
						{
							location_id: 1,
							total_cyclists: 150,
							years: [2023, 2024]
						}
					])
				})
			})
		});
		vi.spyOn(db, 'select').mockImplementation(mockSelect);

		const res = await client.v1.locations.nearby.$get({
			query: { lat: "-8.0476", lon: "-34.8770", radius: "5000" }
		});
		
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data.type).toBe("FeatureCollection");
		expect(data.features).toHaveLength(1);
		expect(data.features[0].properties).toMatchObject({
			name: "Av. Rui Barbosa x R. Amélia",
			city: "Recife",
			total_cyclists: 150,
			years: [2023, 2024]
		});
		expect(data.summary).toMatchObject({
			total_locations: 1,
			total_cyclists: 150,
			by_city: { Recife: 1 }
		});
	});

	it("200 → returns empty collection when no locations nearby", async () => {
		findMany.mockResolvedValueOnce([]);
		
		const mockSelect = vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					groupBy: vi.fn().mockResolvedValue([])
				})
			})
		});
		vi.spyOn(db, 'select').mockImplementation(mockSelect);

		const res = await client.v1.locations.nearby.$get({
			query: { lat: "-8.0476", lon: "-34.8770" }
		});
		
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data.type).toBe("FeatureCollection");
		expect(data.features).toHaveLength(0);
		expect(data.summary.total_locations).toBe(0);
		expect(data.summary.total_cyclists).toBe(0);
	});
});
