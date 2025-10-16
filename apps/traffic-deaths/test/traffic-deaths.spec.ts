import { describe, it, expect, beforeAll, afterAll } from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import { traffic_deaths } from "../src/db/schema.js";

describe("TrafficDeaths API", () => {
	beforeAll(async () => {
		// Setup test data
		await db.insert(traffic_deaths).values([
			{
				contador: 1,
				tipobito: "2",
				dtobito: new Date("2023-01-15"),
				horaobito: "1430",
				natural: "261",
				codmunnatu: 261160,
				dtnasc: new Date("1985-05-20"),
				idade: 38,
				sexo: "1",
				racacor: "4",
				estciv: "2",
				esc2010: "4",
				lococor: "4",
				codmunocor: 261160,
				linhaa: "V892",
				circobito: "1",
				acidtrab: "2",
				fonte: "1",
				exame: "2",
				cirurgia: "2",
				causabas: "V892",
			},
			{
				contador: 2,
				tipobito: "2",
				dtobito: new Date("2023-02-10"),
				horaobito: "0830",
				natural: "261",
				codmunnatu: 261160,
				dtnasc: new Date("1992-08-15"),
				idade: 30,
				sexo: "2",
				racacor: "2",
				estciv: "1",
				esc2010: "5",
				lococor: "1",
				codmunocor: 261160,
				linhaa: "V434",
				circobito: "1",
				acidtrab: "2",
				fonte: "2",
				exame: "1",
				cirurgia: "2",
				causabas: "V434",
			},
		]);
	});

	afterAll(async () => {
		// Cleanup test data
		await db.delete(traffic_deaths);
	});

	describe("Health Check", () => {
		it("should return healthy status", async () => {
			const res = await app.request("/health");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("status", "ok");
			expect(data).toHaveProperty("service", "traffic-deaths");
			expect(data).toHaveProperty("database", "connected");
			expect(data).toHaveProperty("timestamp");
		});
	});

	describe("Traffic Deaths Endpoints", () => {
		it("should list traffic deaths", async () => {
			const res = await app.request("/v1/traffic-deaths");
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data.length).toBeGreaterThanOrEqual(2);

			// Verify structure of first record
			const firstRecord = data[0];
			expect(firstRecord).toHaveProperty("id");
			expect(firstRecord).toHaveProperty("contador");
			expect(firstRecord).toHaveProperty("dtobito");
			expect(firstRecord).toHaveProperty("sexo");
			expect(firstRecord).toHaveProperty("idade");
			expect(firstRecord).toHaveProperty("causabas");
		});

		it("should get specific traffic death by id", async () => {
			// First get the list to find a valid ID
			const listRes = await app.request("/v1/traffic-deaths");
			const listData = await listRes.json();
			const firstId = listData[0].id;

			const res = await app.request(`/v1/traffic-deaths/${firstId}`);
			expect(res.status).toBe(200);

			const data = await res.json();
			expect(data).toHaveProperty("id", firstId);
			expect(data).toHaveProperty("contador");
			expect(data).toHaveProperty("dtobito");
		});

		it("should return 404 for non-existent traffic death", async () => {
			const res = await app.request("/v1/traffic-deaths/99999");
			expect(res.status).toBe(404);

			const data = await res.json();
			expect(data).toHaveProperty("message", "Traffic death record not found");
		});
	});

	describe("Data Validation", () => {
		it("should validate traffic death data structure", async () => {
			const res = await app.request("/v1/traffic-deaths");
			const data = await res.json();

			for (const record of data) {
				// Required fields
				expect(record).toHaveProperty("id");
				expect(record).toHaveProperty("dtobito");
				expect(record).toHaveProperty("created_at");

				// Validate date format
				if (record.dtobito) {
					expect(new Date(record.dtobito)).toBeInstanceOf(Date);
				}

				// Validate enum values
				if (record.sexo) {
					expect(["0", "1", "2"]).toContain(record.sexo);
				}

				if (record.tipobito) {
					expect(["1", "2"]).toContain(record.tipobito);
				}

				if (record.acidtrab) {
					expect(["1", "2", "9"]).toContain(record.acidtrab);
				}
			}
		});
	});

	describe("OpenAPI Documentation", () => {
		it("should serve OpenAPI spec", async () => {
			const res = await app.request("/doc");
			expect(res.status).toBe(200);

			const html = await res.text();
			expect(html).toContain("TrafficDeaths API");
		});
	});
});
