import { describe, it, expect, vi } from "vitest";
import { createTestApp } from "../src/lib/create-app.js";
import bicycleRacksRoutes from "../src/routes/bicycle-racks.index.js";

// Mock database: handlers now read db from context via c.get("db").
// Chainable thenable stub: chain methods return `this` and awaiting resolves to [].
const mockDb: any = {
	select: vi.fn().mockReturnThis(),
	from: vi.fn().mockReturnThis(),
	innerJoin: vi.fn().mockReturnThis(),
	where: vi.fn().mockReturnThis(),
	limit: vi.fn().mockReturnThis(),
	then: (resolve: (v: unknown[]) => unknown) => resolve([]),
	execute: vi.fn().mockResolvedValue({ rows: [] }),
};

describe("Bicycle Racks Handlers", () => {
	const app = createTestApp(bicycleRacksRoutes, mockDb);

	describe("GetById Handler", () => {
		it("should return 404 for non-existent id", async () => {
			const res = await app.request("/bicycle-racks/99999");
			expect(res.status).toBe(404);

			const data = await res.json();
			expect(data).toHaveProperty("message", "Bicycle rack not found");
		});
	});

	describe("GeoJSON Handler", () => {
		it("should return valid GeoJSON structure", async () => {
			const res = await app.request("/bicycle-racks/geojson");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("type", "FeatureCollection");
			expect(data).toHaveProperty("features");
			expect(Array.isArray(data.features)).toBe(true);
		});
	});
});
