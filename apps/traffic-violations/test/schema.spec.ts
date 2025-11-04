import { describe, it, expect } from "vitest";
import {
	insertTrafficViolationSchema,
	selectTrafficViolationSchema,
	type TrafficViolation,
	type NewTrafficViolation,
} from "../src/db/schema.js";

describe("Traffic Violations Schema", () => {
	describe("insertTrafficViolationSchema", () => {
		it("should validate valid traffic violation data", () => {
			const validData = {
				violation_date: new Date("2023-01-15T10:30:00Z"),
				agent_id: 123,
				violation_type_id: 5,
				location_id: 10,
				violation_code: "ART201",
				law_code: "CTB_ART201",
				description: "Estacionar em local proibido",
				location_description: "Rua das Flores, 100",
				coordinates: "-8.0476 -34.8770",
				complementary_data: { additional_info: "test" },
			};

			const result = insertTrafficViolationSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it("should reject invalid data", () => {
			const invalidData = {
				violation_date: "invalid-date",
				agent_id: -1,
				violation_code: "",
			};

			const result = insertTrafficViolationSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});

		it("should handle optional fields", () => {
			const minimalData = {
				violation_date: new Date("2023-01-15T10:30:00Z"),
				agent_id: 123,
				violation_type_id: 5,
				location_id: 10,
				violation_code: "ART201",
				law_code: "CTB_ART201",
				description: "Estacionar em local proibido",
				location_description: "Rua das Flores, 100",
			};

			const result = insertTrafficViolationSchema.safeParse(minimalData);
			expect(result.success).toBe(true);
		});
	});

	describe("selectTrafficViolationSchema", () => {
		it("should validate complete traffic violation record", () => {
			const completeRecord = {
				id: 1,
				violation_date: new Date("2023-01-15T10:30:00Z"),
				agent_id: 123,
				violation_type_id: 5,
				location_id: 10,
				violation_code: "ART201",
				law_code: "CTB_ART201",
				description: "Estacionar em local proibido",
				location_description: "Rua das Flores, 100",
				coordinates: "-8.0476 -34.8770",
				complementary_data: { additional_info: "test" },
				created_at: new Date("2023-01-15T10:30:00Z"),
				updated_at: new Date("2023-01-15T10:30:00Z"),
			};

			const result = selectTrafficViolationSchema.safeParse(completeRecord);
			expect(result.success).toBe(true);
		});
	});

	describe("TypeScript Types", () => {
		it("should have correct TrafficViolation type structure", () => {
			const violation: TrafficViolation = {
				id: 1,
				violation_date: new Date(),
				agent_id: 123,
				violation_type_id: 5,
				location_id: 10,
				violation_code: "ART201",
				law_code: "CTB_ART201",
				description: "Test description",
				location_description: "Test location",
				coordinates: null,
				complementary_data: null,
				created_at: new Date(),
				updated_at: new Date(),
			};

			expect(violation.id).toBeDefined();
			expect(violation.violation_date).toBeInstanceOf(Date);
			expect(typeof violation.agent_id).toBe("number");
		});

		it("should have correct NewTrafficViolation type structure", () => {
			const newViolation: NewTrafficViolation = {
				violation_date: new Date(),
				agent_id: 123,
				violation_type_id: 5,
				location_id: 10,
				violation_code: "ART201",
				law_code: "CTB_ART201",
				description: "Test description",
				location_description: "Test location",
			};

			expect(newViolation.violation_date).toBeInstanceOf(Date);
			expect(typeof newViolation.agent_id).toBe("number");
			expect(newViolation.id).toBeUndefined();
		});
	});
});
