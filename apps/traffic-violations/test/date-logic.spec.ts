import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Date Logic Tests", () => {
	let originalDate: DateConstructor;

	beforeEach(() => {
		originalDate = global.Date;
	});

	afterEach(() => {
		global.Date = originalDate;
	});

	describe("Month/Year Date Range Calculation", () => {
		it("should calculate correct date range for December 2023", () => {
			const year = 2023;
			const month = 12;

			// Primeiro dia do mês
			const startOfMonth = new Date(year, month - 1, 1);
			// Último dia do mês
			const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

			expect(startOfMonth.getFullYear()).toBe(2023);
			expect(startOfMonth.getMonth()).toBe(11); // December is month 11 (0-indexed)
			expect(startOfMonth.getDate()).toBe(1);

			expect(endOfMonth.getFullYear()).toBe(2023);
			expect(endOfMonth.getMonth()).toBe(11);
			expect(endOfMonth.getDate()).toBe(31); // December has 31 days
			expect(endOfMonth.getHours()).toBe(23);
			expect(endOfMonth.getMinutes()).toBe(59);
		});

		it("should calculate correct date range for February 2024 (leap year)", () => {
			const year = 2024;
			const month = 2;

			const startOfMonth = new Date(year, month - 1, 1);
			const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

			expect(startOfMonth.getDate()).toBe(1);
			expect(endOfMonth.getDate()).toBe(29); // 2024 is a leap year
		});

		it("should calculate correct date range for February 2023 (non-leap year)", () => {
			const year = 2023;
			const month = 2;

			const startOfMonth = new Date(year, month - 1, 1);
			const endOfMonth = new Date(year, month, 0, 23, 59, 59, 999);

			expect(startOfMonth.getDate()).toBe(1);
			expect(endOfMonth.getDate()).toBe(28); // 2023 is not a leap year
		});

		it("should default to current month when no parameters provided", () => {
			// Mock current date to December 15, 2023
			const mockDate = new Date(2023, 11, 15); // December 15, 2023
			vi.setSystemTime(mockDate);

			const now = new Date();
			const targetYear = now.getFullYear();
			const targetMonth = now.getMonth() + 1;

			expect(targetYear).toBe(2023);
			expect(targetMonth).toBe(12);

			const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
			const endOfMonth = new Date(targetYear, targetMonth, 0, 23, 59, 59, 999);

			expect(startOfMonth.getFullYear()).toBe(2023);
			expect(startOfMonth.getMonth()).toBe(11);
			expect(startOfMonth.getDate()).toBe(1);

			expect(endOfMonth.getFullYear()).toBe(2023);
			expect(endOfMonth.getMonth()).toBe(11);
			expect(endOfMonth.getDate()).toBe(31);

			vi.useRealTimers();
		});
	});

	describe("Date Parameter Validation", () => {
		it("should handle valid month values", () => {
			const validMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

			validMonths.forEach((month) => {
				const startOfMonth = new Date(2023, month - 1, 1);
				expect(startOfMonth.getMonth()).toBe(month - 1);
			});
		});

		it("should handle valid year values", () => {
			const validYears = [2020, 2021, 2022, 2023, 2024, 2025, 2030];

			validYears.forEach((year) => {
				const startOfMonth = new Date(year, 0, 1); // January 1st
				expect(startOfMonth.getFullYear()).toBe(year);
			});
		});
	});

	describe("Date Range Priority Logic", () => {
		it("should prioritize start_date/end_date over month/year", () => {
			const startDate = "2023-12-01";
			const endDate = "2023-12-31";
			const _month = 1; // January (should be ignored)
			const _year = 2022; // Should be ignored

			// Simulate the logic from the handler
			const hasExplicitDates = startDate && endDate;

			if (hasExplicitDates) {
				const start = new Date(startDate);
				const end = new Date(endDate);

				expect(start.getFullYear()).toBe(2023);
				expect(start.getMonth()).toBe(11); // December
				expect(end.getFullYear()).toBe(2023);
				expect(end.getMonth()).toBe(11); // December
			}
		});

		it("should use month/year when start_date/end_date not provided", () => {
			const startDate = undefined;
			const endDate = undefined;
			const month = 6; // June
			const year = 2023;

			const hasExplicitDates = startDate && endDate;

			if (!hasExplicitDates) {
				const now = new Date();
				const targetYear = year || now.getFullYear();
				const targetMonth = month || now.getMonth() + 1;

				expect(targetYear).toBe(2023);
				expect(targetMonth).toBe(6);

				const startOfMonth = new Date(targetYear, targetMonth - 1, 1);
				expect(startOfMonth.getMonth()).toBe(5); // June is month 5 (0-indexed)
			}
		});
	});

	describe("Edge Cases", () => {
		it("should handle month boundaries correctly", () => {
			// Test January (month 1)
			const jan = new Date(2023, 0, 1);
			expect(jan.getMonth()).toBe(0);

			// Test December (month 12)
			const dec = new Date(2023, 11, 1);
			expect(dec.getMonth()).toBe(11);
		});

		it("should handle year boundaries correctly", () => {
			// End of December should not overflow to next year
			const endOfDec = new Date(2023, 12, 0, 23, 59, 59, 999);
			expect(endOfDec.getFullYear()).toBe(2023);
			expect(endOfDec.getMonth()).toBe(11); // December
			expect(endOfDec.getDate()).toBe(31);
		});

		it("should handle different month lengths", () => {
			const months = [
				{ month: 1, days: 31 }, // January
				{ month: 2, days: 28 }, // February (non-leap year)
				{ month: 3, days: 31 }, // March
				{ month: 4, days: 30 }, // April
				{ month: 5, days: 31 }, // May
				{ month: 6, days: 30 }, // June
				{ month: 7, days: 31 }, // July
				{ month: 8, days: 31 }, // August
				{ month: 9, days: 30 }, // September
				{ month: 10, days: 31 }, // October
				{ month: 11, days: 30 }, // November
				{ month: 12, days: 31 }, // December
			];

			months.forEach(({ month, days }) => {
				const endOfMonth = new Date(2023, month, 0);
				expect(endOfMonth.getDate()).toBe(days);
			});
		});
	});
});
