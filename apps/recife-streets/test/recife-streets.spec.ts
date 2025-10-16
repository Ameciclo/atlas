import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("RecifeStreets API", () => {
	it("should return health check", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		
		const data = await res.json();
		expect(data).toHaveProperty("status", "ok");
		expect(data).toHaveProperty("service", "recife-streets");
	});

	// Add more tests here
});
