import { describe, it, expect, vi, beforeEach } from "vitest";
import { list, getById } from "../src/routes/crashes/crashes.handlers.js";

// Mock database
const mockDb = {
	query: {
		geolocatedCrashes: {
			findMany: vi.fn(),
			findFirst: vi.fn(),
		},
	},
};

vi.mock("../src/db/index.js", () => ({
	db: mockDb,
}));

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
			
			mockDb.query.geolocatedCrashes.findMany.mockResolvedValue(mockCrashes);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({}) },
				json: vi.fn(),
			};

			await list(mockContext as any);

			expect(mockDb.query.geolocatedCrashes.findMany).toHaveBeenCalledWith();
			expect(mockContext.json).toHaveBeenCalledWith(mockCrashes);
		});

		it("should filter by start_date", async () => {
			const mockCrashes = [{ id: 1, timestamp: new Date("2023-06-01") }];
			
			mockDb.query.geolocatedCrashes.findMany.mockResolvedValue(mockCrashes);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({ start_date: "2023-01-01" }) },
				json: vi.fn(),
			};

			await list(mockContext as any);

			expect(mockDb.query.geolocatedCrashes.findMany).toHaveBeenCalledWith({
				where: expect.any(Function),
			});
			expect(mockContext.json).toHaveBeenCalledWith(mockCrashes);
		});

		it("should filter by date range", async () => {
			const mockCrashes = [{ id: 1, timestamp: new Date("2023-06-01") }];
			
			mockDb.query.geolocatedCrashes.findMany.mockResolvedValue(mockCrashes);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({ 
					start_date: "2023-01-01", 
					end_date: "2023-12-31" 
				}) },
				json: vi.fn(),
			};

			await list(mockContext as any);

			expect(mockDb.query.geolocatedCrashes.findMany).toHaveBeenCalledWith({
				where: expect.any(Function),
			});
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
			
			mockDb.query.geolocatedCrashes.findFirst.mockResolvedValue(mockCrash);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({ id: "1" }) },
				json: vi.fn(),
			};

			await getById(mockContext as any);

			expect(mockDb.query.geolocatedCrashes.findFirst).toHaveBeenCalledWith({
				where: expect.any(Function),
			});
			expect(mockContext.json).toHaveBeenCalledWith(mockCrash, 200);
		});

		it("should return 404 when crash not found", async () => {
			mockDb.query.geolocatedCrashes.findFirst.mockResolvedValue(null);

			const mockContext = {
				req: { valid: vi.fn().mockReturnValue({ id: "999" }) },
				json: vi.fn(),
			};

			await getById(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ message: "Not Found" },
				404
			);
		});
	});
});