import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("TrafficDeaths API", () => {
	it("should return health check (database disconnected in test)", async () => {
		const res = await app.request("/health");
		// Database is not connected in test environment, so expect 503
		expect(res.status).toBe(503);

		const data = await res.json();
		expect(data).toHaveProperty("status", "error");
		expect(data).toHaveProperty("service", "traffic-deaths");
		expect(data).toHaveProperty("database", "disconnected");
	});

	it("should return summary with mock data", async () => {
		const res = await app.request("/v1/summary");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("total_deaths", 0);
		expect(data).toHaveProperty("year", null);
		expect(data).toHaveProperty("message");
	});

	it("should return summary with year filter", async () => {
		const res = await app.request("/v1/summary?year=2023");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("total_deaths", 0);
		expect(data).toHaveProperty("year", 2023);
		expect(data).toHaveProperty("message");
	});
});
