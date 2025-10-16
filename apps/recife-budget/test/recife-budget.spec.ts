import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("RecifeBudget API", () => {
	it("should return health check", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("service", "recife-budget");
	});

	// Add more tests here
});
