import { describe, it, expect } from "vitest";
import { list, getById } from "../src/routes/crashes/crashes.routes.js";

describe("Crashes Routes", () => {
	describe("list route", () => {
		it("should have correct path and method", () => {
			expect(list.path).toBe("/crashes");
			expect(list.method).toBe("get");
		});

		it("should have correct tags", () => {
			expect(list.tags).toContain("Crashes");
		});

		it("should have query parameters", () => {
			expect(list.request?.query).toBeDefined();
		});

		it("should have 200 response", () => {
			expect(list.responses[200]).toBeDefined();
		});
	});

	describe("getById route", () => {
		it("should have correct path and method", () => {
			expect(getById.path).toBe("/crashes/{id}");
			expect(getById.method).toBe("get");
		});

		it("should have correct tags", () => {
			expect(getById.tags).toContain("Crashes");
		});

		it("should have path parameters", () => {
			expect(getById.request?.params).toBeDefined();
		});

		it("should have 200 and 404 responses", () => {
			expect(getById.responses[200]).toBeDefined();
			expect(getById.responses[404]).toBeDefined();
		});
	});
});