import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";

// Mock the database methods
const mockSelect = vi.fn();
const mockExecute = vi.fn();
vi.spyOn(db, "select").mockImplementation(mockSelect);
vi.spyOn(db, "execute").mockImplementation(mockExecute);

describe("TrafficDeaths API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return health check (database disconnected in test)", async () => {
		// Mock database execute to throw an error (simulating disconnection)
		mockExecute.mockRejectedValue(new Error("Database connection failed"));

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

	it("should return cyclist deaths for all years", async () => {
		// Mock the database query chain for cyclist deaths and total deaths
		// When no filters, the second query doesn't use .where()
		mockSelect
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ count: 12189 }]),
				}),
			})
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ count: 320320 }]),
				}),
			});

		const res = await app.request("/v1/deaths/cyclists");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("total_cyclist_deaths", 12189);
		expect(data).toHaveProperty("year", null);
		expect(data).toHaveProperty("city_code", null);
		expect(data).toHaveProperty("percentage_of_total", 3.81);
		expect(data).toHaveProperty(
			"message",
			"Cyclist deaths (all years and cities)",
		);
	});

	it("should return cyclist deaths filtered by year", async () => {
		// Mock the database query chain for cyclist deaths and total deaths
		mockSelect
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ count: 1510 }]),
				}),
			})
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ count: 35938 }]),
				}),
			});

		const res = await app.request("/v1/deaths/cyclists?year=2023");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("total_cyclist_deaths", 1510);
		expect(data).toHaveProperty("year", 2023);
		expect(data).toHaveProperty("city_code", null);
		expect(data).toHaveProperty("percentage_of_total", 4.2);
		expect(data).toHaveProperty("message", "Cyclist deaths in 2023");
	});

	it("should return cyclist deaths filtered by city", async () => {
		// Mock the database query chain for cyclist deaths and total deaths
		mockSelect
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ count: 223 }]),
				}),
			})
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockResolvedValue([{ count: 4025 }]),
				}),
			});

		const res = await app.request("/v1/deaths/cyclists?city_code=261160");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("total_cyclist_deaths", 223);
		expect(data).toHaveProperty("year", null);
		expect(data).toHaveProperty("city_code", 261160);
		expect(data).toHaveProperty("percentage_of_total", 5.54);
		expect(data).toHaveProperty("message", "Cyclist deaths in city 261160");
	});
});
