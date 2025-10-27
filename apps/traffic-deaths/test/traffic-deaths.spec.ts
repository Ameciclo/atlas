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

	it("should return deaths by city", async () => {
		// Mock the database query chain
		mockSelect.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					groupBy: vi.fn().mockReturnValue({
						orderBy: vi.fn().mockResolvedValue([
							{ city_code: 2611606, total_deaths: 518 },
							{ city_code: 2607901, total_deaths: 31 },
							{ city_code: 2602902, total_deaths: 28 },
						]),
					}),
				}),
			}),
		});

		const res = await app.request("/v1/deaths/by-city?year=2023");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("location_type", "occurrence");
		expect(data).toHaveProperty("year", 2023);
		expect(data).toHaveProperty("cities");
		expect(data.cities).toHaveLength(3);
		expect(data.cities[0]).toHaveProperty("city_code", 2611606);
		expect(data.cities[0]).toHaveProperty("city_name", "Recife");
		expect(data.cities[0]).toHaveProperty("total_deaths", 518);
	});

	it("should return deaths by transport mode", async () => {
		// Mock the database query chain - will be called multiple times for each transport mode
		mockSelect.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ count: 100 }]),
			}),
		});

		const res = await app.request("/v1/deaths/by-transport-mode?year=2023");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("year", 2023);
		expect(data).toHaveProperty("city_code", null);
		expect(data).toHaveProperty("location_type", "occurrence");
		expect(data).toHaveProperty("transport_modes");
		expect(data).toHaveProperty("total");
	});

	it("should return time series data", async () => {
		// Mock the database query chain
		mockSelect.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					groupBy: vi.fn().mockReturnValue({
						orderBy: vi.fn().mockResolvedValue([
							{ year: 2021, total_deaths: 497 },
							{ year: 2022, total_deaths: 497 },
							{ year: 2023, total_deaths: 676 },
						]),
					}),
				}),
			}),
		});

		const res = await app.request(
			"/v1/deaths/time-series?start_year=2021&end_year=2023",
		);
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("start_year", 2021);
		expect(data).toHaveProperty("end_year", 2023);
		expect(data).toHaveProperty("data");
		expect(data.data).toHaveLength(3);
		expect(data).toHaveProperty("total");
		expect(data).toHaveProperty("average_per_year");
	});

	it("should return comprehensive statistics", async () => {
		// Mock year range query
		mockSelect
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi
						.fn()
						.mockResolvedValue([{ min_year: 2015, max_year: 2023 }]),
				}),
			})
			// Mock yearly deaths query
			.mockReturnValueOnce({
				from: vi.fn().mockReturnValue({
					where: vi.fn().mockReturnValue({
						groupBy: vi.fn().mockReturnValue({
							orderBy: vi.fn().mockResolvedValue([
								{ year: 2015, total: 748 },
								{ year: 2016, total: 713 },
								{ year: 2017, total: 665 },
								{ year: 2018, total: 630 },
								{ year: 2019, total: 567 },
								{ year: 2020, total: 571 },
								{ year: 2021, total: 497 },
								{ year: 2022, total: 497 },
								{ year: 2023, total: 676 },
							]),
						}),
					}),
				}),
			});

		const res = await app.request("/v1/stats");
		expect(res.status).toBe(200);

		const data = await res.json();
		expect(data).toHaveProperty("latest_year", 2023);
		expect(data).toHaveProperty("latest_year_deaths", 676);
		expect(data).toHaveProperty("previous_year_deaths", 497);
		expect(data).toHaveProperty("growth_percentage");
		expect(data).toHaveProperty("most_violent_year");
		expect(data.most_violent_year).toHaveProperty("year", 2015);
		expect(data.most_violent_year).toHaveProperty("total_deaths", 748);
		expect(data).toHaveProperty("last_5_years");
		expect(data).toHaveProperty("all_time");
	});
});
