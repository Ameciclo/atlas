import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";

describe("SharedBike API", () => {
	beforeAll(async () => {
		// Setup test database connection
		await db.$client.query("SELECT 1");
	});

	afterAll(async () => {
		// Cleanup database connection
		await db.$client.end();
	});

	describe("Health Check", () => {
		it("should return health status", async () => {
			const res = await app.request("/health");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("status", "ok");
			expect(data).toHaveProperty("service", "shared-bike");
			expect(data).toHaveProperty("database");
		});
	});

	describe("Stations API", () => {
		describe("GET /v1/stations", () => {
			it("should return list of stations", async () => {
				const res = await app.request("/v1/stations");
				expect(res.status).toBe(200);

				const data = await res.json();
				expect(Array.isArray(data)).toBe(true);
			});

			it("should filter by network", async () => {
				const res = await app.request("/v1/stations?network=BikePE");
				expect(res.status).toBe(200);

				const data = await res.json();
				expect(Array.isArray(data)).toBe(true);
			});

			it("should filter by operator", async () => {
				const res = await app.request("/v1/stations?operator=Tembici");
				expect(res.status).toBe(200);

				const data = await res.json();
				expect(Array.isArray(data)).toBe(true);
			});

			it("should filter by capacity range", async () => {
				const res = await app.request("/v1/stations?min_capacity=15&max_capacity=30");
				expect(res.status).toBe(200);

				const data = await res.json();
				expect(Array.isArray(data)).toBe(true);
			});
		});

		describe("GET /v1/stations/:id", () => {
			it("should return station by ID", async () => {
				const res = await app.request("/v1/stations/1");
				
				if (res.status === 200) {
					const data = await res.json();
					expect(data).toHaveProperty("id");
					expect(data).toHaveProperty("name");
				} else {
					expect(res.status).toBe(404);
				}
			});

			it("should return 400 for invalid ID", async () => {
				const res = await app.request("/v1/stations/invalid");
				expect(res.status).toBe(400);

				const data = await res.json();
				expect(data).toHaveProperty("error", "Invalid station ID");
			});

			it("should return 404 for non-existent station", async () => {
				const res = await app.request("/v1/stations/999999");
				expect(res.status).toBe(404);

				const data = await res.json();
				expect(data).toHaveProperty("error", "Station not found");
			});
		});
	});
});
