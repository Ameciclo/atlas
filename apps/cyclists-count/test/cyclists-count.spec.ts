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
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import type { CyclistsCount } from "../src/db/schema.js";

const client = testClient(app);

// Mock database methods
const execute = vi.spyOn(db, "execute");
const select = vi.spyOn(db, "select");

beforeAll(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2025-01-14T12:00:00.000Z"));
});

afterAll(() => {
	vi.useRealTimers();
});

describe("GET /health", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → when database is connected", async () => {
		execute.mockResolvedValueOnce([{ result: "ok" }]);

		const res = await app.request("/health");
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("service", "cyclists-count");
		expect(data).toHaveProperty("database", "connected");
	});

	it("503 → when database is disconnected", async () => {
		execute.mockRejectedValueOnce(new Error("Connection failed"));

		const res = await app.request("/health");
		expect(res.status).toBe(503);
		
		const data = await res.json();
		expect(data).toHaveProperty("status", "error");
		expect(data).toHaveProperty("database", "disconnected");
	});
});

describe("GET /v1/cyclists-counts", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → empty array if no counts", async () => {
		select.mockReturnValue({
			from: vi.fn().mockResolvedValue([])
		} as any);

		const res = await app.request("/v1/cyclists-counts");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("200 → returns cyclists counts data", async () => {
		const fakeDate = new Date();
		const fake: CyclistsCount[] = [
			{
				id: 1,
				data: { sessions: [{ total_count: 42 }] },
				metadata: { location_name: "Test Location" },
				coordinates: { x: -34.8851, y: -8.1137 },
				created_at: fakeDate,
				updated_at: fakeDate,
			},
		];
		select.mockReturnValue({
			from: vi.fn().mockResolvedValue(fake)
		} as any);

		const res = await app.request("/v1/cyclists-counts");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(
			fake.map((r) => ({
				...r,
				created_at: fakeDate.toISOString(),
				updated_at: fakeDate.toISOString(),
			}))
		);
	});

	it("500 → when the DB throws", async () => {
		select.mockImplementation(() => {
			throw new Error("Database error");
		});

		const res = await app.request("/v1/cyclists-counts");
		expect(res.status).toBe(500);
	});
});

describe("GET /v1/cyclists-counts/:id", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns the count when found", async () => {
		const fakeDate = new Date();
		const fake: CyclistsCount = {
			id: 1,
			data: { sessions: [{ total_count: 42 }] },
			metadata: { location_name: "Test Location" },
			coordinates: { x: -34.8851, y: -8.1137 },
			created_at: fakeDate,
			updated_at: fakeDate,
		};
		select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([fake])
			})
		} as any);

		const res = await app.request("/v1/cyclists-counts/1");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			...fake,
			created_at: fakeDate.toISOString(),
			updated_at: fakeDate.toISOString(),
		});
	});

	it("404 → when the count does not exist", async () => {
		select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([])
			})
		} as any);

		const res = await app.request("/v1/cyclists-counts/999");
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Cyclists count not found" });
	});
});