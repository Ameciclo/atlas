import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";

// Mock the database select method
const mockSelect = vi.fn();
vi.spyOn(db, "select").mockImplementation(mockSelect);

describe("TrafficDeaths API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return health check (database disconnected in test)", async () => {
		const res = await app.request("/health");
		// Database is not connected in test environment, so expect 503
		expect(res.status).toBe(503);

		const data = await res.json();
		expect(data).toHaveProperty("status", "error");
		expect(data).toHaveProperty("service", "traffic-deaths");
		expect(data).toHaveProperty("database", "disconnected");
	});

	it("should return summary with all years", async () => {
		// Mock the database query chain
		mockSelect.mockReturnValue({
			from: vi.fn().mockReturnValue([{ count: 320320 }]),
		});

		const res = await app.request("/v1/summary");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("total_deaths", 320320);
		expect(data).toHaveProperty("year", null);
		expect(data).toHaveProperty("message", "Total traffic deaths (all years)");
	});

	it("should return summary with year filter", async () => {
		// Mock the database query chain
		mockSelect.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 35938 }]),
			}),
		});

		const res = await app.request("/v1/summary?year=2023");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("total_deaths", 35938);
		expect(data).toHaveProperty("year", 2023);
		expect(data).toHaveProperty("message", "Total traffic deaths in 2023");
	});
});
