// test/app.spec.ts
import {
  describe,
  it,
  expect,
  beforeEach,
  vi,
  beforeAll,
  afterAll,
} from "vitest";
import { testClient } from "hono/testing"; // ← Hono’s helper
import { app } from "../src/index.js"; // ← your Hono instance
import * as dbModule from "../src/db/index.js"; // ← to spy on Drizzle

// Create a typed client for your app
const client = testClient(app);

const findMany = vi.spyOn(dbModule.db.query.cyclistProfiles, "findMany");

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
    const res = await client.index.$get("/"); // ← hit GET /
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  it("200 → returns whatever Drizzle gives us", async () => {
    const fakeDate = new Date();
    const fake = [
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
