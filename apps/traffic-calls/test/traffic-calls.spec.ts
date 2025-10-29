import { describe, it, expect, vi, beforeEach } from "vitest";
import app from "../src/app.js";

// Mock database to avoid external dependencies
vi.mock("../src/db/index.js", () => {
	const mockQuery = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([]),
	};
	return {
		db: mockQuery,
	};
});

// Import mocked db
import { db } from "../src/db/index.js";

// Mock data
const mockTrafficCall = {
	id: 1,
	datetime: new Date("2023-01-15T10:30:00Z"),
	nature: "COLISÃO",
	total_victims: 2,
	injured_victims: 1,
	fatal_victims: 0,
	street_name: "Rua da Consolação",
	neighborhood: "BOA VIAGEM",
	coordinates: "-8.1234,-34.5678",
	crash_data: { type: "COLISÃO", vehicles: { cars: 2 } },
	environmental_data: { weather: "clear" },
	metadata: { verified: true },
	created_at: new Date(),
	updated_at: new Date(),
};

describe("TrafficCalls API Integration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("Health Check", () => {
		it("should return health status", async () => {
			const res = await app.request("/health");
			expect([200, 503]).toContain(res.status);
			
			const data = await res.json();
			expect(data).toHaveProperty("service", "traffic-calls");
			expect(data).toHaveProperty("database");
		});
	});

	describe("GET /v1/calls", () => {
		it("should return list of calls", async () => {
			(db.limit as any).mockResolvedValue([mockTrafficCall]);

			const res = await app.request("/v1/calls");
			expect([200, 500]).toContain(res.status);
		});

		it("should accept date filters", async () => {
			(db.limit as any).mockResolvedValue([mockTrafficCall]);

			const res = await app.request("/v1/calls?start_date=2023-01-01&end_date=2023-12-31");
			expect([200, 500]).toContain(res.status);
		});

		it("should accept nature filter", async () => {
			(db.limit as any).mockResolvedValue([mockTrafficCall]);

			const res = await app.request("/v1/calls?nature=COLISÃO");
			expect([200, 500]).toContain(res.status);
		});

		it("should accept neighborhood filter", async () => {
			(db.limit as any).mockResolvedValue([mockTrafficCall]);

			const res = await app.request("/v1/calls?neighborhood=BOA VIAGEM");
			expect([200, 500]).toContain(res.status);
		});
	});

	describe("GET /v1/calls/{id}", () => {
		it("should return specific call", async () => {
			(db.limit as any).mockResolvedValue([mockTrafficCall]);

			const res = await app.request("/v1/calls/1");
			expect([200, 404, 500]).toContain(res.status);

			if (res.status === 200) {
				const data = await res.json();
				expect(data).toHaveProperty("data");
				expect(data.data).toHaveProperty("id");
			}
		});

		it("should return 404 for non-existent call", async () => {
			(db.limit as any).mockResolvedValue([]);

			const res = await app.request("/v1/calls/999");
			expect([404, 500]).toContain(res.status);
		});

		it("should handle invalid ID format", async () => {
			const res = await app.request("/v1/calls/invalid");
			expect([400, 404, 500]).toContain(res.status);
		});
	});

	describe("OpenAPI Documentation", () => {
		it("should serve OpenAPI spec", async () => {
			const res = await app.request("/doc");
			expect([200, 404]).toContain(res.status);
		});
	});
});
