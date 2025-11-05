import { describe, it, expect } from "vitest";
import { testClient } from "hono/testing";
import app from "../src/app.js";

describe("Cycling Infrastructure API Integration Tests", () => {
	const client = testClient(app);

	describe("Health Check", () => {
		it("should return health status", async () => {
			const res = await client.health.$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toMatchObject({
				status: expect.stringMatching(/ok|error/),
				service: "cycling-infra",
				database: expect.stringMatching(/connected|disconnected/),
				timestamp: expect.any(String),
			});
		});
	});

	describe("Infrastructure Endpoints", () => {
		it("GET /v1/infrastructure should return infrastructure list", async () => {
			const res = await client.v1.infrastructure.$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);

			if (data.length > 0) {
				expect(data[0]).toMatchObject({
					id: expect.any(Number),
					osm_id: expect.any(String),
					infra_type: expect.any(String),
					geojson: expect.any(Object),
				});
			}
		});

		it("GET /v1/infrastructure with type filter should work", async () => {
			const res = await client.v1.infrastructure.$get({
				query: { type: "Ciclofaixa" },
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);

			// All results should be of the filtered type
			data.forEach((item) => {
				expect(item.infra_type).toBe("Ciclofaixa");
			});
		});

		it("GET /v1/infrastructure with limit should work", async () => {
			const res = await client.v1.infrastructure.$get({
				query: { limit: "5" },
			});
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeLessThanOrEqual(5);
		});

		it("GET /v1/infrastructure/{id} should return specific infrastructure", async () => {
			// First get a list to find a valid ID
			const listRes = await client.v1.infrastructure.$get({
				query: { limit: "1" },
			});
			const listData = await listRes.json();

			if (listData.length > 0) {
				const id = listData[0].id;
				const res = await client.v1.infrastructure[":id"].$get({
					param: { id: id.toString() },
				});
				expect(res.status).toBe(200);

				const data = await res.json();
				expect(data.id).toBe(id);
			}
		});

		it("GET /v1/infrastructure/{id} should return 404 for non-existent ID", async () => {
			const res = await client.v1.infrastructure[":id"].$get({
				param: { id: "999999" },
			});
			expect(res.status).toBe(404);

			const data = await res.json();
			expect(data).toMatchObject({
				error: "Infrastructure not found",
			});
		});

		it("GET /v1/infrastructure/{id} should return 400 for invalid ID", async () => {
			const res = await client.v1.infrastructure[":id"].$get({
				param: { id: "invalid" },
			});
			expect(res.status).toBe(400);

			const data = await res.json();
			expect(data).toMatchObject({
				error: "Invalid ID",
			});
		});
	});

	describe("Ways Endpoints", () => {
		it("GET /v1/ways should return ways list", async () => {
			const res = await client.v1.ways.$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);

			if (data.length > 0) {
				expect(data[0]).toMatchObject({
					id: expect.any(Number),
					osm_id: expect.any(String),
					geometry_type: expect.any(String),
					geojson: expect.any(Object),
				});
			}
		});

		it("GET /v1/ways/summary should return summary statistics", async () => {
			const res = await client.v1.ways.summary.$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toMatchObject({
				all: {
					pdc_feito: expect.any(Number),
					out_pdc: expect.any(Number),
					pdc_total: expect.any(Number),
					percent: expect.any(Number),
				},
				byCity: expect.any(Object),
			});
		});

		it("GET /v1/ways/all-ways should return GeoJSON", async () => {
			const res = await client.v1.ways["all-ways"].$get();
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toMatchObject({
				all: {
					type: "FeatureCollection",
					features: expect.any(Array),
				},
				byCity: expect.any(Object),
			});

			// Check GeoJSON structure
			if (data.all.features.length > 0) {
				const feature = data.all.features[0];
				expect(feature).toMatchObject({
					type: "Feature",
					geometry: expect.any(Object),
					properties: expect.objectContaining({
						STATUS: expect.stringMatching(/Realizada|Projeto|NotPDC/),
					}),
				});
			}
		});
	});
});
