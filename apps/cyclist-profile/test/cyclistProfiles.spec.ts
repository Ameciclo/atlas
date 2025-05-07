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
import * as dbModule from "../src/db/index.js";
import type { CyclistProfile } from "../src/db/schema.js";
import { app } from "../src/index.js";

// Create a typed client for your app
const client = testClient(app);

// Spy on Drizzle methods
const findMany = vi.spyOn(dbModule.db.query.cyclistProfiles, "findMany");
const findFirst = vi.spyOn(dbModule.db.query.cyclistProfiles, "findFirst");

beforeAll(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2025-05-07T12:00:00.000Z"));
});

afterAll(() => {
	vi.useRealTimers();
});

describe("GET /", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → empty array if no profiles", async () => {
		findMany.mockResolvedValueOnce([]);

		const res = await client.index.$get("/");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("200 → returns whatever Drizzle gives us", async () => {
		const fakeDate = new Date(); // frozen at 2025-05-07T12:00:00.000Z
		const fake: CyclistProfile[] = [
			{
				id: 42,
				data: { name: "Rider" },
				metadata: {},
				created_at: fakeDate,
				updated_at: fakeDate,
			},
		];
		findMany.mockResolvedValueOnce(fake);

		const res = await client.index.$get("/");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(
			fake.map((r) => ({
				...r,
				created_at: fakeDate.toISOString(),
				updated_at: fakeDate.toISOString(),
			})),
		);
	});

	it("500 → when the DB throws", async () => {
		findMany.mockRejectedValueOnce(new Error("💥"));

		const res = await client.index.$get("/");
		expect(res.status).toBe(500);
		expect(await res.json()).toEqual({
			error: "Failed to fetch cyclist profiles. Database error.",
		});
	});
});

describe("GET /:id", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → returns the profile when found", async () => {
		const fakeDate = new Date();
		const fake: CyclistProfile = {
			id: 42,
			data: { name: "Rider" },
			metadata: {},
			created_at: fakeDate,
			updated_at: fakeDate,
		};
		findFirst.mockResolvedValueOnce(fake);

		const res = await client[":id"].$get({ param: { id: "42" } });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			...fake,
			created_at: fakeDate.toISOString(),
			updated_at: fakeDate.toISOString(),
		});
	});

	it("404 → when the profile does not exist", async () => {
		findFirst.mockResolvedValueOnce(undefined);

		const res = await client[":id"].$get({ param: { id: "42" } });
		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ error: "Not found" });
	});
});
