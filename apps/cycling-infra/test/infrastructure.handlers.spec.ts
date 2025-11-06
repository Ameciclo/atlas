import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";
import {
	list,
	getById,
} from "../src/routes/infrastructure/infrastructure.handlers.js";

// Mock the database
vi.mock("@atlas/database", () => ({
	createConnectedDatabase: vi.fn(() => ({
		select: vi.fn(() => ({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					limit: vi.fn(() => Promise.resolve([mockInfrastructure])),
				})),
				limit: vi.fn(() => Promise.resolve([mockInfrastructure])),
			})),
		})),
	})),
}));

const mockInfrastructure = {
	id: 1,
	osm_id: "way/42509040",
	name: "Rua Delmiro Gouveia",
	infra_type: "Ciclofaixa",
	coordinates: "mock_coordinates",
	geojson: {
		type: "Feature",
		geometry: { type: "LineString", coordinates: [] },
		properties: { name: "Test" },
	},
	created_at: "2025-01-01T00:00:00.000Z",
	updated_at: "2025-01-01T00:00:00.000Z",
};

const createMockContext = (
	query: Record<string, string> = {},
	params: Record<string, string> = {},
) =>
	({
		req: {
			query: () => query,
			param: (key: string) => params[key],
		},
		json: vi.fn(),
	}) as unknown as Context;

describe("Infrastructure Handlers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list", () => {
		it("should return infrastructure list", async () => {
			const mockContext = createMockContext();

			await list(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith([mockInfrastructure]);
		});

		it("should filter by type when provided", async () => {
			const mockContext = createMockContext({ type: "Ciclofaixa" });

			await list(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith([mockInfrastructure]);
		});

		it("should apply limit when provided", async () => {
			const mockContext = createMockContext({ limit: "5" });

			await list(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith([mockInfrastructure]);
		});

		it("should handle database errors", async () => {
			const { createConnectedDatabase } = await import("@atlas/database");
			const mockDb = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => ({
							limit: vi.fn(() => Promise.reject(new Error("DB Error"))),
						})),
						limit: vi.fn(() => Promise.reject(new Error("DB Error"))),
					})),
				})),
			};
			vi.mocked(createConnectedDatabase).mockResolvedValueOnce(mockDb as never);

			const mockContext = createMockContext();

			await list(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ error: "Internal server error" },
				500,
			);
		});
	});

	describe("getById", () => {
		it("should return infrastructure by ID", async () => {
			const { createConnectedDatabase } = await import("@atlas/database");
			const mockDb = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => Promise.resolve([mockInfrastructure])),
					})),
				})),
			};
			vi.mocked(createConnectedDatabase).mockResolvedValueOnce(mockDb as never);

			const mockContext = createMockContext({}, { id: "1" });

			await getById(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith(mockInfrastructure);
		});

		it("should return 400 for invalid ID", async () => {
			const mockContext = createMockContext({}, { id: "invalid" });

			await getById(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ error: "Invalid ID" },
				400,
			);
		});

		it("should return 404 when infrastructure not found", async () => {
			const { createConnectedDatabase } = await import("@atlas/database");
			const mockDb = {
				select: vi.fn(() => ({
					from: vi.fn(() => ({
						where: vi.fn(() => Promise.resolve([])),
					})),
				})),
			};
			vi.mocked(createConnectedDatabase).mockResolvedValueOnce(mockDb as never);

			const mockContext = createMockContext({}, { id: "999" });

			await getById(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ error: "Infrastructure not found" },
				404,
			);
		});
	});
});
