import { describe, it, expect, vi } from "vitest";

// Simple mock test to verify setup
vi.mock("../src/db/index.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([{ id: 1, test: "data" }]),
	},
}));

import { db } from "../src/db/index.js";

describe("Mock Test", () => {
	it("should mock database correctly", async () => {
		const result = await db.select().from({}).where({}).orderBy({}).limit(1);
		expect(result).toEqual([{ id: 1, test: "data" }]);
	});
});