import { describe, it, expect } from "vitest";
import app from "../src/app.js";

describe("BicycleRacks API Routes", () => {
	describe("Route Structure", () => {
		it("should have health endpoint", async () => {
			const res = await app.request("/health");
			expect([200, 503]).toContain(res.status);
		});

		it("should have bicycle-racks list endpoint", async () => {
			const res = await app.request("/v1/bicycle-racks");
			expect([200, 500]).toContain(res.status);
		});

		it("should have bicycle-racks by id endpoint", async () => {
			const res = await app.request("/v1/bicycle-racks/1");
			expect([200, 404, 500]).toContain(res.status);
		});

		it("should have nearby endpoint", async () => {
			const res = await app.request(
				"/v1/bicycle-racks/nearby?lat=-8.0476&lng=-34.8770",
			);
			expect([200, 500]).toContain(res.status);
		});

		it("should have stats endpoint", async () => {
			const res = await app.request("/v1/bicycle-racks/stats");
			expect([200, 500]).toContain(res.status);
		});

		it("should have geojson endpoint", async () => {
			const res = await app.request("/v1/bicycle-racks/geojson");
			expect([200, 500]).toContain(res.status);
		});
	});

	describe("Validation", () => {
		it("should validate invalid id format", async () => {
			const res = await app.request("/v1/bicycle-racks/abc");
			expect(res.status).toBe(422);

			const data = await res.json();
			expect(data).toHaveProperty("success", false);
			expect(data).toHaveProperty("error");
		});

		it("should validate missing nearby parameters", async () => {
			const res = await app.request("/v1/bicycle-racks/nearby");
			expect(res.status).toBe(422);
		});

		it("should validate invalid coordinate format", async () => {
			const res = await app.request(
				"/v1/bicycle-racks/nearby?lat=invalid&lng=-34.8770",
			);
			expect(res.status).toBe(422);
		});
	});

	describe("Query Parameters", () => {
		it("should accept covered filter", async () => {
			const res = await app.request("/v1/bicycle-racks?covered=yes");
			expect([200, 500]).toContain(res.status);
		});

		it("should accept access filter", async () => {
			const res = await app.request("/v1/bicycle-racks?access=yes");
			expect([200, 500]).toContain(res.status);
		});

		it("should accept operator filter", async () => {
			const res = await app.request("/v1/bicycle-racks?operator=test");
			expect([200, 500]).toContain(res.status);
		});

		it("should accept capacity filters", async () => {
			const res = await app.request(
				"/v1/bicycle-racks?capacity_min=10&capacity_max=50",
			);
			expect([200, 500]).toContain(res.status);
		});
	});

	describe("Response Format", () => {
		it("should return JSON responses", async () => {
			const res = await app.request("/v1/bicycle-racks/abc");
			expect(res.headers.get("content-type")).toContain("application/json");
		});

		it("should handle CORS", async () => {
			const res = await app.request("/health", {
				method: "OPTIONS",
			});
			expect([200, 204]).toContain(res.status);
		});
	});
});
