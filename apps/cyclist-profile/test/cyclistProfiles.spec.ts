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
import type { CyclistProfile } from "../src/db/schema.js";

const client = testClient(app);

// Mock the entire db module
vi.mock("../src/db/index.js", () => ({
	db: {
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockResolvedValue([]),
		}),
	},
}));

const mockDb = vi.mocked(db);

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
		(mockDb.select().from as any).mockResolvedValueOnce([]);

		const res = await client.v1["cyclist-profiles"].$get("/");
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
				coordinates: null,
				created_at: fakeDate,
				updated_at: fakeDate,
			},
		];
		(mockDb.select().from as any).mockResolvedValueOnce(fake);

		const res = await client.v1["cyclist-profiles"].$get("/");
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
		(mockDb.select().from as any).mockRejectedValueOnce(new Error("💥"));

		const res = await client.v1["cyclist-profiles"].$get("/");
		expect(res.status).toBe(500);

		expect(await res.json()).toMatchObject({ message: "💥" });
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
			coordinates: null,
			created_at: fakeDate,
			updated_at: fakeDate,
		};
		(mockDb.select().from as any).mockReturnValue({
			where: vi.fn().mockReturnValue({
				limit: vi.fn().mockResolvedValueOnce([fake]),
			}),
		});

		const res = await (client.v1 as any)["cyclist-profiles"][":id"].$get({
			param: { id: 42 },
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			...fake,
			created_at: fakeDate.toISOString(),
			updated_at: fakeDate.toISOString(),
		});
	});

	it("404 → when the profile does not exist", async () => {
		(mockDb.select().from as any).mockReturnValue({
			where: vi.fn().mockReturnValue({
				limit: vi.fn().mockResolvedValueOnce([]),
			}),
		});

		const res = await (client.v1 as any)["cyclist-profiles"][":id"].$get({
			param: { id: 42 },
		});

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Not Found" });
	});
});
