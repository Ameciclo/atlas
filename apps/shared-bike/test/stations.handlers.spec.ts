import { describe, it, expect, vi, beforeEach } from "vitest";
import { listStations, getStation } from "../src/routes/stations/stations.handlers.js";
import { db } from "../src/db/index.js";

// Mock do banco de dados
vi.mock("../src/db/index.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
	},
}));

// Mock do contexto Hono
const createMockContext = (query = {}, params = {}) => ({
	req: {
		query: () => query,
		param: (key: string) => params[key],
	},
	json: vi.fn(),
});

describe("Stations Handlers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("listStations", () => {
		it("should return all stations without filters", async () => {
			const mockStations = [
				{ id: 1, name: "Station 1", network: "BikePE" },
				{ id: 2, name: "Station 2", network: "BikePE" },
			];

			// Mock da query do banco
			vi.mocked(db.select().from().where().orderBy).mockResolvedValue(mockStations);

			const mockContext = createMockContext();
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});

		it("should filter by network", async () => {
			const mockStations = [
				{ id: 1, name: "Station 1", network: "BikePE" },
			];

			vi.mocked(db.select().from().where().orderBy).mockResolvedValue(mockStations);

			const mockContext = createMockContext({ network: "BikePE" });
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});

		it("should filter by operator", async () => {
			const mockStations = [
				{ id: 1, name: "Station 1", operator: "Tembici" },
			];

			vi.mocked(db.select().from().where().orderBy).mockResolvedValue(mockStations);

			const mockContext = createMockContext({ operator: "Tembici" });
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});

		it("should filter by capacity range", async () => {
			const mockStations = [
				{ id: 1, name: "Station 1", capacity: 20 },
			];

			vi.mocked(db.select().from().where().orderBy).mockResolvedValue(mockStations);

			const mockContext = createMockContext({ 
				min_capacity: "15", 
				max_capacity: "25" 
			});
			await listStations(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStations);
		});
	});

	describe("getStation", () => {
		it("should return station by valid ID", async () => {
			const mockStation = { id: 1, name: "Station 1", network: "BikePE" };

			vi.mocked(db.select().from().where().limit).mockResolvedValue([mockStation]);

			const mockContext = createMockContext({}, { id: "1" });
			await getStation(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(mockStation);
		});

		it("should return 400 for invalid ID", async () => {
			const mockContext = createMockContext({}, { id: "invalid" });
			await getStation(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ error: "Invalid station ID" },
				400
			);
		});

		it("should return 404 for non-existent station", async () => {
			vi.mocked(db.select().from().where().limit).mockResolvedValue([]);

			const mockContext = createMockContext({}, { id: "999" });
			await getStation(mockContext as any);

			expect(mockContext.json).toHaveBeenCalledWith(
				{ error: "Station not found" },
				404
			);
		});
	});
});