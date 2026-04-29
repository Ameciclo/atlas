import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	listStations,
	getStation,
} from "../src/routes/stations/stations.handlers.js";

// Chainable mock db — handlers now read it from c.get("db").
const db: any = {
	select: vi.fn().mockReturnThis(),
	from: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	orderBy: vi.fn().mockReturnThis(),
	limit: vi.fn().mockReturnThis(),
};

// Mock do contexto Hono
const createMockContext = (
	query: Record<string, string> = {},
	params: Record<string, string> = {},
) =>
	({
		req: {
			query: () => query,
			param: (key: string) => params[key as keyof typeof params],
		},
		json: vi.fn(),
		get: (key: string) => (key === "db" ? db : undefined),
	}) as unknown as { json: ReturnType<typeof vi.fn> };

const restoreChain = () => {
	db.select.mockReturnThis();
	db.from.mockReturnThis();
	db.where.mockReturnThis();
	db.orderBy.mockReturnThis();
	db.limit.mockReturnThis();
};

describe("Stations Handlers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		restoreChain();
	});

	describe("listStations", () => {
		it("should return all stations without filters", async () => {
			const mockStations = [
				{ id: 1, name: "Station 1", network: "BikePE" },
				{ id: 2, name: "Station 2", network: "BikePE" },
			];

			db.orderBy.mockResolvedValue(mockStations);

			const mockContext = createMockContext();
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});

		it("should filter by network", async () => {
			const mockStations = [{ id: 1, name: "Station 1", network: "BikePE" }];

			db.orderBy.mockResolvedValue(mockStations);

			const mockContext = createMockContext({ network: "BikePE" });
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});

		it("should filter by operator", async () => {
			const mockStations = [{ id: 1, name: "Station 1", operator: "Tembici" }];

			db.orderBy.mockResolvedValue(mockStations);

			const mockContext = createMockContext({ operator: "Tembici" });
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});

		it("should filter by capacity range", async () => {
			const mockStations = [{ id: 1, name: "Station 1", capacity: 20 }];

			db.orderBy.mockResolvedValue(mockStations);

			const mockContext = createMockContext({
				min_capacity: "15",
				max_capacity: "25",
			});
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});
	});

	describe("getStation", () => {
		it("should return station by valid ID", async () => {
			const mockStation = { id: 1, name: "Station 1", network: "BikePE" };

			db.limit.mockResolvedValue([mockStation]);

			const mockContext = createMockContext({}, { id: "1" });
			await getStation(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStation);
		});

		it("should return 400 for invalid ID", async () => {
			const mockContext = createMockContext({}, { id: "invalid" });
			await getStation(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ error: "Invalid station ID" },
				400,
			);
		});

		it("should return 404 for non-existent station", async () => {
			db.limit.mockResolvedValue([]);

			const mockContext = createMockContext({}, { id: "999" });
			await getStation(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ error: "Station not found" },
				404,
			);
		});
	});
});
