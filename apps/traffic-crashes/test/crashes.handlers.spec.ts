import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Context } from "hono";

vi.mock("../src/db/index.js", () => ({
	db: {
		query: {
			geolocatedCrashes: {
				findMany: vi.fn(),
				findFirst: vi.fn(),
			},
		},
	},
}));

const { db } = await import("../src/db/index.js");
const { list, getById } = await import("../src/routes/crashes/crashes.handlers.js");

describe("Crashes Handlers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("list handler", () => {
		it("should return all crashes when no filters", async () => {
			const mockCrashes = [
				{ id: 1, timestamp: new Date(), n_injured: 2, n_deaths: 0 },
				{ id: 2, timestamp: new Date(), n_injured: 1, n_deaths: 1 },
			];
			
			(db.query.geolocatedCrashes.findMany as vi.MockedFunction<typeof db.query.geolocatedCrashes.findMany>).mockResolvedValue(mockCrashes);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({}) },
				json: vi.fn(),
			} as unknown as Context;

			await list(mockContext);

			expect(db.query.geolocatedCrashes.findMany).toHaveBeenCalledWith();
			expect(mockContext.json).toHaveBeenCalledWith(mockCrashes);
		});

		it("should filter by start_date", async () => {
			const mockCrashes = [{ id: 1, timestamp: new Date("2023-06-01") }];
			
			(db.query.geolocatedCrashes.findMany as vi.MockedFunction<typeof db.query.geolocatedCrashes.findMany>).mockResolvedValue(mockCrashes);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({ start_date: "2023-01-01" }) },
				json: vi.fn(),
			} as unknown as Context;

			await list(mockContext);

			expect(db.query.geolocatedCrashes.findMany).toHaveBeenCalledWith({
				where: expect.any(Function),
			});
			expect(mockContext.json).toHaveBeenCalledWith(mockCrashes);
		});
	});

	describe("getById handler", () => {
		it("should return crash when found", async () => {
			const mockCrash = { 
				id: 1, 
				timestamp: new Date(), 
				n_injured: 2, 
				n_deaths: 0,
				coordinates: "POINT(-34.123 -8.456)"
			};
			
			(db.query.geolocatedCrashes.findFirst as vi.MockedFunction<typeof db.query.geolocatedCrashes.findFirst>).mockResolvedValue(mockCrash);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({ id: "1" }) },
				json: vi.fn(),
			} as unknown as Context;

			await getById(mockContext);

			expect(db.query.geolocatedCrashes.findFirst).toHaveBeenCalledWith({
				where: expect.any(Function),
			});
			expect(mockContext.json).toHaveBeenCalledWith(mockCrash, 200);
		});

		it("should return 404 when crash not found", async () => {
			(db.query.geolocatedCrashes.findFirst as vi.MockedFunction<typeof db.query.geolocatedCrashes.findFirst>).mockResolvedValue(null);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({ id: "999" }) },
				json: vi.fn(),
			} as unknown as Context;

			await getById(mockContext);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ message: "Not Found" },
				404
			);
		});
	});
});