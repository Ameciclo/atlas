import { describe, it, expect } from "vitest";
import {
	listViolationsRoute,
	getViolationRoute,
} from "../src/routes/violations/violations.routes.js";

describe("Violations Routes", () => {
	describe("listViolationsRoute", () => {
		it("should have correct method and path", () => {
			expect(listViolationsRoute.method).toBe("get");
			expect(listViolationsRoute.path).toBe("/violations");
		});

		it("should have correct tags", () => {
			expect(listViolationsRoute.tags).toContain("Traffic Violations");
		});

		it("should have query parameters schema", () => {
			expect(listViolationsRoute.request?.query).toBeDefined();
		});

		it("should have 200 response", () => {
			expect(listViolationsRoute.responses[200]).toBeDefined();
			expect(
				listViolationsRoute.responses[200].content["application/json"],
			).toBeDefined();
		});
	});

	describe("getViolationRoute", () => {
		it("should have correct method and path", () => {
			expect(getViolationRoute.method).toBe("get");
			expect(getViolationRoute.path).toBe("/violations/{id}");
		});

		it("should have correct tags", () => {
			expect(getViolationRoute.tags).toContain("Traffic Violations");
		});

		it("should have params schema", () => {
			expect(getViolationRoute.request?.params).toBeDefined();
		});

		it("should have 200 and 404 responses", () => {
			expect(getViolationRoute.responses[200]).toBeDefined();
			expect(getViolationRoute.responses[404]).toBeDefined();
			expect(
				getViolationRoute.responses[200].content["application/json"],
			).toBeDefined();
			expect(
				getViolationRoute.responses[404].content["application/json"],
			).toBeDefined();
		});
	});
});
