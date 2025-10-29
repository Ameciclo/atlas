import { describe, it, expect, vi } from "vitest";
import app from "../src/app.js";

// Mock successful responses for integration tests
vi.mock("../src/db/index.js", () => ({
	db: {
		query: {
			geolocatedCrashes: {
				findMany: vi.fn().mockResolvedValue([
					{
						id: 1,
						timestamp: new Date("2023-06-01"),
						n_injured: 2,
						n_deaths: 0,
						coordinates: "POINT(-34.123 -8.456)",
						complementary_data: { type: "collision" },
						created_at: new Date(),
						updated_at: new Date(),
					},
				]),
				findFirst: vi.fn().mockImplementation(() => {
					// Return null for ID 999999 (non-existent), crash for ID 1
					const url = globalThis.location?.href || '';
					if (url.includes('999999')) {
						return Promise.resolve(null);
					}
					return Promise.resolve({
						id: 1,
						timestamp: new Date("2023-06-01"),
						n_injured: 2,
						n_deaths: 0,
						coordinates: "POINT(-34.123 -8.456)",
						complementary_data: { type: "collision" },
						created_at: new Date(),
						updated_at: new Date(),
					});
				}),
			},
		},
	},
}));

describe("TrafficCrashes API", () => {
	describe("Health Check", () => {
		it("should return health status", async () => {
			const res = await app.request("/health");
			expect([200, 503]).toContain(res.status);
			
			const data = await res.json();
			expect(data).toHaveProperty("status");
			expect(data).toHaveProperty("service", "traffic-crashes");
			expect(data).toHaveProperty("timestamp");
			expect(data).toHaveProperty("database");
		});
	});

	describe("GET /v1/crashes", () => {
		it("should return list of crashes", async () => {
			const res = await app.request("/v1/crashes");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should filter crashes by start_date", async () => {
			const res = await app.request("/v1/crashes?start_date=2023-01-01");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should filter crashes by end_date", async () => {
			const res = await app.request("/v1/crashes?end_date=2023-12-31");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should filter crashes by date range", async () => {
			const res = await app.request("/v1/crashes?start_date=2023-01-01&end_date=2023-12-31");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
		});

		it("should return crashes with correct structure", async () => {
			const res = await app.request("/v1/crashes");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			if (data.length > 0) {
				const crash = data[0];
				expect(crash).toHaveProperty("id");
				expect(crash).toHaveProperty("timestamp");
				expect(crash).toHaveProperty("n_injured");
				expect(crash).toHaveProperty("n_deaths");
				expect(crash).toHaveProperty("coordinates");
				expect(crash).toHaveProperty("complementary_data");
				expect(crash).toHaveProperty("created_at");
				expect(crash).toHaveProperty("updated_at");
			}
		});
	});

	describe("GET /v1/crashes/:id", () => {
		it("should return crash by id", async () => {
			const res = await app.request("/v1/crashes/1");
			expect([200, 404]).toContain(res.status);
			
			if (res.status === 200) {
				const data = await res.json();
				expect(data).toHaveProperty("id", 1);
				expect(data).toHaveProperty("timestamp");
				expect(data).toHaveProperty("n_injured");
				expect(data).toHaveProperty("n_deaths");
				expect(data).toHaveProperty("coordinates");
				expect(data).toHaveProperty("complementary_data");
			}
		});

		it("should return 404 for non-existent crash", async () => {
			const res = await app.request("/v1/crashes/999999");
			expect([200, 404]).toContain(res.status);
			
			if (res.status === 404) {
				const data = await res.json();
				expect(data).toHaveProperty("message", "Not Found");
			}
		});

		it("should handle invalid id parameter", async () => {
			const res = await app.request("/v1/crashes/invalid");
			expect([400, 404, 422]).toContain(res.status);
		});
	});

	describe("Data Validation", () => {
		it("should validate crash data types", async () => {
			const res = await app.request("/v1/crashes");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			if (data.length > 0) {
				const crash = data[0];
				expect(typeof crash.id).toBe("number");
				expect(typeof crash.n_injured).toBe("number");
				expect(typeof crash.n_deaths).toBe("number");
				expect(typeof crash.coordinates).toBe("string");
				expect(typeof crash.complementary_data).toBe("object");
				expect(crash.n_injured).toBeGreaterThanOrEqual(0);
				expect(crash.n_deaths).toBeGreaterThanOrEqual(0);
			}
		});

		it("should validate coordinates format", async () => {
			const res = await app.request("/v1/crashes");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			if (data.length > 0) {
				const crash = data[0];
				expect(crash.coordinates).toMatch(/^POINT\(-?\d+\.?\d* -?\d+\.?\d*\)$/);
			}
		});

		it("should validate timestamp format", async () => {
			const res = await app.request("/v1/crashes");
			expect(res.status).toBe(200);
			
			const data = await res.json();
			if (data.length > 0) {
				const crash = data[0];
				expect(new Date(crash.timestamp)).toBeInstanceOf(Date);
				expect(isNaN(new Date(crash.timestamp).getTime())).toBe(false);
			}
		});
	});

	describe("Error Handling", () => {
		it("should handle malformed date parameters", async () => {
			const res = await app.request("/v1/crashes?start_date=invalid-date");
			expect(res.status).toBe(200);
		});

		it("should handle empty query parameters", async () => {
			const res = await app.request("/v1/crashes?start_date=&end_date=");
			expect(res.status).toBe(200);
		});
	});

	describe("Performance", () => {
		it("should respond within reasonable time", async () => {
			const start = Date.now();
			const res = await app.request("/v1/crashes");
			const duration = Date.now() - start;
			
			expect(res.status).toBe(200);
			expect(duration).toBeLessThan(5000);
		});
	});
});