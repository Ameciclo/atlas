import { describe, it, expect } from "vitest";
import { listStationsRoute, getStationRoute } from "../src/routes/stations/stations.routes.js";

describe("Stations Routes", () => {
	describe("listStationsRoute", () => {
		it("should have correct method and path", () => {
			expect(listStationsRoute.method).toBe("get");
			expect(listStationsRoute.path).toBe("/stations");
		});

		it("should have correct tags", () => {
			expect(listStationsRoute.tags).toEqual(["Stations"]);
		});

		it("should have query parameters schema", () => {
			const querySchema = listStationsRoute.request?.query;
			expect(querySchema).toBeDefined();
			
			// Testa se os parâmetros opcionais estão definidos
			const shape = querySchema?._def?.shape();
			expect(shape).toHaveProperty("network");
			expect(shape).toHaveProperty("operator");
			expect(shape).toHaveProperty("min_capacity");
			expect(shape).toHaveProperty("max_capacity");
		});

		it("should have 200 response schema", () => {
			const responses = listStationsRoute.responses;
			expect(responses).toHaveProperty("200");
			expect(responses[200]).toHaveProperty("content");
			expect(responses[200].content).toHaveProperty("application/json");
		});
	});

	describe("getStationRoute", () => {
		it("should have correct method and path", () => {
			expect(getStationRoute.method).toBe("get");
			expect(getStationRoute.path).toBe("/stations/{id}");
		});

		it("should have correct tags", () => {
			expect(getStationRoute.tags).toEqual(["Stations"]);
		});

		it("should have params schema", () => {
			const paramsSchema = getStationRoute.request?.params;
			expect(paramsSchema).toBeDefined();
			
			const shape = paramsSchema?._def?.shape();
			expect(shape).toHaveProperty("id");
		});

		it("should have 200 and 404 response schemas", () => {
			const responses = getStationRoute.responses;
			expect(responses).toHaveProperty("200");
			expect(responses).toHaveProperty("404");
			
			expect(responses[200]).toHaveProperty("content");
			expect(responses[404]).toHaveProperty("content");
		});
	});
});