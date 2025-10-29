import { describe, it, expect, vi } from "vitest";
import { testClient } from "hono/testing";
import { OpenAPIHono } from "@hono/zod-openapi";
import { listCallsRoute, getCallRoute } from "../src/routes/calls/calls.routes.js";

describe("Calls Routes", () => {
	describe("Route Definitions", () => {
		it("should have correct listCallsRoute configuration", () => {
			expect(listCallsRoute.method).toBe("get");
			expect(listCallsRoute.path).toBe("/calls");
			expect(listCallsRoute.responses[200]).toBeDefined();
			expect(listCallsRoute.responses[500]).toBeDefined();
		});

		it("should have correct getCallRoute configuration", () => {
			expect(getCallRoute.method).toBe("get");
			expect(getCallRoute.path).toBe("/calls/{id}");
			expect(getCallRoute.responses[200]).toBeDefined();
			expect(getCallRoute.responses[404]).toBeDefined();
			expect(getCallRoute.responses[500]).toBeDefined();
		});
	});

	describe("OpenAPI Integration", () => {
		it("should integrate routes with OpenAPI app", () => {
			const app = new OpenAPIHono();
			
			// Mock handlers
			const mockListHandler = vi.fn();
			const mockGetHandler = vi.fn();

			app.openapi(listCallsRoute, mockListHandler);
			app.openapi(getCallRoute, mockGetHandler);

			const client = testClient(app);

			expect(client).toBeDefined();
		});
	});
});