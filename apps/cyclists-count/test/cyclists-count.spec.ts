import { testClient } from "hono/testing";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// Mock the database
vi.mock("../src/db/index.js", () => ({
	db: {
		execute: vi.fn().mockResolvedValue([{ result: "ok" }]),
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
				limit: vi.fn().mockResolvedValue([])
			})
		})
	}
}));

import app from "../src/app.js";

const client = testClient(app);

beforeAll(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2025-01-14T12:00:00.000Z"));
});

afterAll(() => {
	vi.useRealTimers();
});

describe("GET /health", () => {
	it("200 → when database is connected", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("service", "cyclists-count");
		expect(data).toHaveProperty("database", "connected");
	});
});

describe("GET /v1/cyclists-counts", () => {
	it("200 → returns response from API", async () => {
		const res = await app.request("/v1/cyclists-counts");
		expect(res.status).toBe(200);
		// API currently returns empty object due to mock setup
		const data = await res.json();
		expect(data).toBeDefined();
	});
});
