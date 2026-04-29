import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import { createApp } from "../src/lib/create-app.js";
import { violationsRoutes } from "../src/routes/violations/violations.index.js";

describe("Violations API Integration Tests", () => {
	const app = createApp();
	app.route("/v1", violationsRoutes);
	const client = testClient(app);

	describe("GET /v1/violations", () => {
		it("should return violations for current month by default", async () => {
			const res = await client.v1.violations.$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should return violations for specific month and year", async () => {
			const res = await client.v1.violations.$get({
				query: {
					month: "12",
					year: "2023",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should return violations for date range when start_date and end_date provided", async () => {
			const res = await client.v1.violations.$get({
				query: {
					start_date: "2023-12-01",
					end_date: "2023-12-31",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should validate month parameter", async () => {
			const res = await client.v1.violations.$get({
				query: {
					month: "13", // Invalid month
				},
			});
			expect(res.status).toBe(400);
		});

		it("should validate year parameter", async () => {
			const res = await client.v1.violations.$get({
				query: {
					year: "2019", // Invalid year (below minimum)
				},
			});
			expect(res.status).toBe(400);
		});

		it("should respect limit parameter", async () => {
			const res = await client.v1.violations.$get({
				query: {
					limit: "5",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeLessThanOrEqual(5);
		});

		it("should filter by agent_id", async () => {
			const res = await client.v1.violations.$get({
				query: {
					agent_id: "1",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should filter by violation_type_id", async () => {
			const res = await client.v1.violations.$get({
				query: {
					violation_type_id: "5",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});
	});

	describe("GET /v1/violations/by-location", () => {
		it("should return violations grouped by location for current month", async () => {
			const res = await client.v1.violations["by-location"].$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("locations");
			expect(Array.isArray(data.locations)).toBe(true);
		});

		it("should return violations by location for specific month/year", async () => {
			const res = await client.v1.violations["by-location"].$get({
				query: {
					month: "11",
					year: "2023",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("locations");
			expect(Array.isArray(data.locations)).toBe(true);
		});

		it("should include ranking in location results", async () => {
			const res = await client.v1.violations["by-location"].$get({
				query: {
					limit: "10",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			if (data.locations.length > 0) {
				expect(data.locations[0]).toHaveProperty("ranking");
				expect(data.locations[0]).toHaveProperty("total_violations");
				expect(data.locations[0]).toHaveProperty("location_description");
			}
		});
	});

	describe("GET /v1/violations/geojson", () => {
		it("should return GeoJSON for current month", async () => {
			const res = await client.v1.violations.geojson.$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("type", "FeatureCollection");
			expect(data).toHaveProperty("features");
			expect(Array.isArray(data.features)).toBe(true);
		});

		it("should return GeoJSON for specific month/year", async () => {
			const res = await client.v1.violations.geojson.$get({
				query: {
					month: "10",
					year: "2023",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("type", "FeatureCollection");
			expect(data).toHaveProperty("features");
		});

		it("should filter by violation_type_id", async () => {
			const res = await client.v1.violations.geojson.$get({
				query: {
					violation_type_id: "5",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("type", "FeatureCollection");
		});

		it("should respect limit parameter", async () => {
			const res = await client.v1.violations.geojson.$get({
				query: {
					limit: "10",
				},
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data.features.length).toBeLessThanOrEqual(10);
		});
	});

	describe("Date Range Logic", () => {
		it("should prioritize start_date/end_date over month/year", async () => {
			const res = await client.v1.violations.$get({
				query: {
					month: "1",
					year: "2023",
					start_date: "2023-12-01",
					end_date: "2023-12-31",
				},
			});
			expect(res.status).toBe(200);

			// The API should use start_date/end_date and ignore month/year
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid date formats", async () => {
			const res = await client.v1.violations.$get({
				query: {
					start_date: "invalid-date",
				},
			});
			expect(res.status).toBe(400);
		});

		it("should handle negative limit", async () => {
			const res = await client.v1.violations.$get({
				query: {
					limit: "-1",
				},
			});
			expect(res.status).toBe(400);
		});

		it("should handle limit exceeding maximum", async () => {
			const res = await client.v1.violations.$get({
				query: {
					limit: "101",
				},
			});
			expect(res.status).toBe(400);
		});
	});
});
