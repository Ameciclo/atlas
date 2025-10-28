import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("EmergencyCalls API", () => {
	it("should return health check", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("service", "emergency-calls");
	});

	describe("Calls Endpoints", () => {
		it("should list emergency calls with pagination", async () => {
			const res = await app.request("/v1/calls?limit=5");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("data");
			expect(data).toHaveProperty("total");
			expect(data).toHaveProperty("limit", 5);
			expect(data).toHaveProperty("offset", 0);
			expect(Array.isArray(data.data)).toBe(true);
			expect(data.data.length).toBeLessThanOrEqual(5);
		});

		it("should filter calls by municipality", async () => {
			const res = await app.request("/v1/calls?municipality=RECIFE&limit=3");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data.data.length).toBeLessThanOrEqual(3);
			if (data.data.length > 0) {
				expect(data.data[0]).toHaveProperty("municipality", "RECIFE");
			}
		});

		it("should get a specific call by ID", async () => {
			const listRes = await app.request("/v1/calls?limit=1");
			const listData = await listRes.json();

			if (listData.data.length > 0) {
				const callId = listData.data[0].id;
				const res = await app.request(`/v1/calls/${callId}`);
				expect(res.status).toBe(200);

				const data = await res.json();
				expect(data).toHaveProperty("id", callId);
			}
		});

		it("should return 404 for non-existent call", async () => {
			const res = await app.request("/v1/calls/999999");
			expect(res.status).toBe(404);
		});
	});

	describe("Analytics Endpoints", () => {
		it("should return municipality statistics", async () => {
			const res = await app.request("/v1/analytics/municipalities");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			if (data.length > 0) {
				expect(data[0]).toHaveProperty("municipality");
				expect(data[0]).toHaveProperty("call_count");
			}
		});

		it("should return gender distribution", async () => {
			const res = await app.request("/v1/analytics/gender-distribution");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			if (data.length > 0) {
				expect(data[0]).toHaveProperty("gender");
				expect(data[0]).toHaveProperty("count");
				expect(data[0]).toHaveProperty("percentage");
			}
		});

		it("should return dangerous streets data", async () => {
			const res = await app.request("/v1/analytics/dangerous-streets?limit=5");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			if (data.length > 0) {
				expect(data[0]).toHaveProperty("street");
				expect(data[0]).toHaveProperty("total_accidents");
				expect(data[0]).toHaveProperty("fatal_cases");
				expect(data[0]).toHaveProperty("fatality_rate");
			}
		});
	});
});
