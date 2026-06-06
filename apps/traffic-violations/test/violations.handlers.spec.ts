import type { Context } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getViolationHandler,
	listViolationsHandler,
	violationsByLocationHandler,
} from "../src/routes/violations/violations.handlers.js";

// Mock do banco de dados
vi.mock("../../db/index.js", () => ({
	db: {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockReturnThis(),
		groupBy: vi.fn().mockReturnThis(),
		then: vi.fn().mockResolvedValue([]),
	},
}));

describe("Violations Handlers", () => {
	let mockContext: any;

	beforeEach(() => {
		mockContext = {
			req: {
				valid: vi.fn(),
			},
			json: vi.fn(),
		};
	});

	describe("Handler Functions", () => {
		it("should be defined", () => {
			expect(listViolationsHandler).toBeDefined();
			expect(typeof listViolationsHandler).toBe("function");
		});

		it("should be defined", () => {
			expect(getViolationHandler).toBeDefined();
			expect(typeof getViolationHandler).toBe("function");
		});

		it("should be defined", () => {
			expect(violationsByLocationHandler).toBeDefined();
			expect(typeof violationsByLocationHandler).toBe("function");
		});
	});

	describe("listViolationsHandler", () => {
		it("should handle month/year parameters", async () => {
			mockContext.req.valid.mockReturnValue({
				month: 12,
				year: 2023,
				limit: 10,
				offset: 0,
			});
			mockContext.json.mockReturnValue({ data: [] });

			const _result = await listViolationsHandler(mockContext as Context);
			expect(mockContext.req.valid).toHaveBeenCalledWith("query");
			expect(mockContext.json).toHaveBeenCalled();
		});

		it("should handle start_date/end_date parameters", async () => {
			mockContext.req.valid.mockReturnValue({
				start_date: "2023-12-01",
				end_date: "2023-12-31",
				limit: 10,
				offset: 0,
			});
			mockContext.json.mockReturnValue({ data: [] });

			const _result = await listViolationsHandler(mockContext as Context);
			expect(mockContext.req.valid).toHaveBeenCalledWith("query");
			expect(mockContext.json).toHaveBeenCalled();
		});

		it("should default to current month when no parameters provided", async () => {
			mockContext.req.valid.mockReturnValue({
				limit: 10,
				offset: 0,
			});
			mockContext.json.mockReturnValue({ data: [] });

			const _result = await listViolationsHandler(mockContext as Context);
			expect(mockContext.req.valid).toHaveBeenCalledWith("query");
			expect(mockContext.json).toHaveBeenCalled();
		});
	});

	describe("violationsByLocationHandler", () => {
		it("should handle month/year parameters", async () => {
			mockContext.req.valid.mockReturnValue({
				month: 11,
				year: 2023,
				limit: 50,
			});
			mockContext.json.mockReturnValue({ locations: [] });

			const _result = await violationsByLocationHandler(mockContext as Context);
			expect(mockContext.req.valid).toHaveBeenCalledWith("query");
			expect(mockContext.json).toHaveBeenCalled();
		});
	});
});
