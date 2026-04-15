import { OpenAPIHono } from "@hono/zod-openapi";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import createApp from "../src/lib/create-app.js";
import cyclistProfilesRoutes from "../src/routes/cyclist-profiles/cyclist-profiles.index.js";
import type { CyclistProfile } from "../src/db/schema.js";

// Chainable mock db injected via an outer middleware — handlers read it
// from c.get("db"). Tests reshape `from`/`where`/`limit` per-case.
const mockDb: any = {
	select: vi.fn(),
};

// Build a test app that matches the production routing (router mounted at
// /v1/) and pre-sets the mocked db on the context before dbMiddleware runs.
const outer = new OpenAPIHono<any>({ strict: false });
outer.use(async (c, next) => {
	c.set("db", mockDb as never);
	await next();
});
const app: any = outer.route(
	"/",
	createApp().route("/v1/", cyclistProfilesRoutes as any),
);

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
		mockDb.select.mockReturnValue({
			from: vi.fn().mockResolvedValueOnce([]),
		});

		const res = await app.request("/v1/cyclist-profiles");
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
		mockDb.select.mockReturnValue({
			from: vi.fn().mockResolvedValueOnce(fake),
		});

		const res = await app.request("/v1/cyclist-profiles");
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
		mockDb.select.mockReturnValue({
			from: vi.fn().mockRejectedValueOnce(new Error("💥")),
		});

		const res = await app.request("/v1/cyclist-profiles");
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
		mockDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValueOnce([fake]),
				}),
			}),
		});

		const res = await app.request("/v1/cyclist-profiles/42");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			...fake,
			created_at: fakeDate.toISOString(),
			updated_at: fakeDate.toISOString(),
		});
	});

	it("404 → when the profile does not exist", async () => {
		mockDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValueOnce([]),
				}),
			}),
		});

		const res = await app.request("/v1/cyclist-profiles/42");

		expect(res.status).toBe(404);
		expect(await res.json()).toEqual({ message: "Not Found" });
	});
});

