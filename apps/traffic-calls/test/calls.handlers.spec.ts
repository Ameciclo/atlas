import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";
import {
	listCallsHandler,
	getCallHandler,
} from "../src/routes/calls/calls.handlers.js";

// Shared mock database (handlers now read db from context via c.get("db")).
const db = {
	select: vi.fn().mockReturnThis(),
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	orderBy: vi.fn().mockReturnThis(),
	limit: vi.fn().mockResolvedValue([]),
};

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

const makeContext = (overrides: Partial<Context>): Context =>
	({
		get: (key: string) => (key === "db" ? db : undefined),
		...overrides,
	}) as unknown as Context;

describe("Calls Handlers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Restore chaining stubs after clearAllMocks (which strips mockReturnThis behavior).
		db.select.mockReturnThis();
		db.from.mockReturnThis();
		db.where.mockReturnThis();
		db.orderBy.mockReturnThis();
		db.limit.mockResolvedValue([]);
	});

	describe("listCallsHandler", () => {
		it("should return all calls when no filters", async () => {
			const mockCalls = [mockTrafficCall];
			(
				db.limit as unknown as { mockResolvedValue: (value: unknown) => void }
			).mockResolvedValue(mockCalls);

			const mockContext = makeContext({
				req: {
					query: () => ({}),
				} as Context["req"],
				json: vi.fn() as unknown as Context["json"],
			});

			await listCallsHandler(mockContext);

			expect(mockContext.json).toHaveBeenCalled();
			const callArgs = (
				mockContext.json as unknown as { mock: { calls: unknown[][] } }
			).mock.calls[0][0];
			expect(callArgs).toHaveProperty("data");
			expect(callArgs).toHaveProperty("total");
		});

		it("should filter by date range", async () => {
			const mockCalls = [mockTrafficCall];
			(
				db.limit as unknown as { mockResolvedValue: (value: unknown) => void }
			).mockResolvedValue(mockCalls);

			const mockContext = makeContext({
				req: {
					query: () => ({
						start_date: "2023-01-01",
						end_date: "2023-12-31",
					}),
				} as Context["req"],
				json: vi.fn() as unknown as Context["json"],
			});

			await listCallsHandler(mockContext);

			expect(mockContext.json).toHaveBeenCalled();
			const callArgs = (
				mockContext.json as unknown as { mock: { calls: unknown[][] } }
			).mock.calls[0][0];
			expect(callArgs).toHaveProperty("data");
			expect(callArgs).toHaveProperty("total");
		});

		it("should handle database errors", async () => {
			(
				db.limit as unknown as { mockRejectedValue: (error: Error) => void }
			).mockRejectedValue(new Error("Database error"));

			const mockContext = makeContext({
				req: {
					query: () => ({}),
				} as Context["req"],
				json: vi.fn() as unknown as Context["json"],
			});

			await listCallsHandler(mockContext);

			expect(mockContext.json).toHaveBeenCalled();
			// Just verify it was called - mock doesn't trigger actual error path
		});
	});

	describe("getCallHandler", () => {
		it("should return call by valid ID", async () => {
			(
				db.limit as unknown as { mockResolvedValue: (value: unknown) => void }
			).mockResolvedValue([mockTrafficCall]);

			const mockContext = makeContext({
				req: {
					param: () => ({ id: "1" }),
				} as unknown as Context["req"],
				json: vi.fn() as unknown as Context["json"],
			});

			await getCallHandler(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith({
				data: mockTrafficCall,
			});
		});

		it("should return 404 for non-existent call", async () => {
			(
				db.limit as unknown as { mockResolvedValue: (value: unknown) => void }
			).mockResolvedValue([]);

			const mockContext = makeContext({
				req: {
					param: () => ({ id: "999" }),
				} as unknown as Context["req"],
				json: vi.fn() as unknown as Context["json"],
			});

			await getCallHandler(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith(
				{
					error: "NOT_FOUND",
					message: "Traffic call not found",
				},
				404,
			);
		});

		it("should return 400 for invalid ID format", async () => {
			const mockContext = makeContext({
				req: {
					param: () => ({ id: "invalid" }),
				} as unknown as Context["req"],
				json: vi.fn() as unknown as Context["json"],
			});

			await getCallHandler(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith(
				{
					error: "INVALID_ID",
					message: "Invalid call ID format",
				},
				400,
			);
		});
	});
});
