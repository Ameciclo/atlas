import { describe, it, expect } from "vitest";
import {
	selectGeolocatedCrashSchema,
	insertGeolocatedCrashSchema,
} from "../src/db/schema.js";

describe("Schema Validation", () => {
	describe("selectGeolocatedCrashSchema", () => {
		it("should validate valid crash data", () => {
			const validCrash = {
				id: 1,
				timestamp: new Date(),
				n_injured: 2,
				n_deaths: 0,
				coordinates: "POINT(-34.123 -8.456)",
				complementary_data: { street: "Rua A", neighborhood: "Centro" },
				created_at: new Date(),
				updated_at: new Date(),
			};

			const result = selectGeolocatedCrashSchema.safeParse(validCrash);
			expect(result.success).toBe(true);
		});

		it("should reject invalid data types", () => {
			const invalidCrash = {
				id: "not-a-number",
				timestamp: "invalid-date",
				n_injured: -1,
				n_deaths: "zero",
			};

			const result = selectGeolocatedCrashSchema.safeParse(invalidCrash);
			expect(result.success).toBe(false);
		});
	});

	describe("insertGeolocatedCrashSchema", () => {
		it("should validate insert data without id", () => {
			const validInsert = {
				timestamp: new Date(),
				n_injured: 1,
				n_deaths: 0,
				coordinates: "POINT(-34.123 -8.456)",
				complementary_data: { type: "collision" },
			};

			const result = insertGeolocatedCrashSchema.safeParse(validInsert);
			expect(result.success).toBe(true);
		});

		it("should use default values", () => {
			const minimalInsert = {
				timestamp: new Date(),
				coordinates: "POINT(-34.123 -8.456)",
				complementary_data: {},
			};

			const result = insertGeolocatedCrashSchema.safeParse(minimalInsert);
			expect(result.success).toBe(true);
		});
	});
});
