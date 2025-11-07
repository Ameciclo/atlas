import { beforeEach, describe, expect, it, vi } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";

// Mock the database methods
const mockSelect = vi.fn();
const mockExecute = vi.fn();
vi.spyOn(db, "select").mockImplementation(mockSelect);
vi.spyOn(db, "execute").mockImplementation(mockExecute);

describe("TrafficCalls API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return health check (database disconnected in test)", async () => {
		// Mock database execute to throw an error (simulating disconnection)
		mockExecute.mockRejectedValue(new Error("Database connection failed"));

		const res = await app.request("/health");
		expect(res.status).toBe(503);

		const data = await res.json();
		expect(data).toHaveProperty("status", "error");
		expect(data).toHaveProperty("service", "traffic-calls");
	});

	// Add more tests here
});
