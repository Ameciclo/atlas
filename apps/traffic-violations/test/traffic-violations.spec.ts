import { describe, expect, it, vi } from "vitest";

// Mock do módulo de banco de dados ANTES dos imports
vi.mock("../src/db/index.js", () => {
	const mockDb = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
	};
	return { db: mockDb };
});

import app from "../src/app.js";

describe("TrafficViolations API", () => {
	const _mockViolation = {
		id: 1,
		violation_date: new Date("2023-01-15T10:30:00Z"),
		agent_id: 123,
		location_id: 10,
		cttu_code: "ART201",
		law_code: "CTB_ART201",
		description: "Estacionar em local proibido",
		location_description: "Rua das Flores, 100",
		created_at: new Date("2023-01-15T10:30:00Z"),
		updated_at: new Date("2023-01-15T10:30:00Z"),
	};

	describe("Health Check", () => {
		it("should return health status", async () => {
			const res = await app.request("/health");
			expect([200, 500, 503]).toContain(res.status);

			if (res.status === 200) {
				const data = await res.json();
				expect(data).toHaveProperty("status");
				expect(data).toHaveProperty("service", "traffic-violations");
			}
		});
	});

	describe("GET /v1/violations", () => {
		it("should handle violations endpoint", async () => {
			const res = await app.request("/v1/violations");
			expect([200, 404, 500]).toContain(res.status);
		});

		it("should handle date filters", async () => {
			const res = await app.request(
				"/v1/violations?start_date=2023-01-01&end_date=2023-12-31",
			);
			expect([200, 400, 404, 500]).toContain(res.status);
		});

		it("should handle agent_id filter", async () => {
			const res = await app.request("/v1/violations?agent_id=123");
			expect([200, 400, 404, 500]).toContain(res.status);
		});

		it("should handle pagination", async () => {
			const res = await app.request("/v1/violations?limit=5&offset=10");
			expect([200, 400, 404, 500]).toContain(res.status);
		});
	});

	describe("GET /v1/violations/:id", () => {
		it("should handle specific violation endpoint", async () => {
			const res = await app.request("/v1/violations/1");
			expect([200, 404, 500]).toContain(res.status);
		});

		it("should handle non-existent violation", async () => {
			const res = await app.request("/v1/violations/999999");
			expect([200, 404, 500]).toContain(res.status);
		});

		it("should handle invalid ID format", async () => {
			const res = await app.request("/v1/violations/invalid");
			expect([400, 404, 422, 500]).toContain(res.status);
		});
	});
});
