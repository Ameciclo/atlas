import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("InfoRequest API", () => {
	it("should return health check", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("service", "info-request");
	});

	// Add more tests here
});
