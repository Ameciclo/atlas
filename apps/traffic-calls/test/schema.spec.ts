import { describe, it, expect } from "vitest";
import {
	selectTrafficCallSchema,
	insertTrafficCallSchema,
	crashDataSchema,
	environmentalDataSchema,
	metadataSchema,
} from "../src/db/schema.js";

describe("Schema Validation", () => {
	describe("crashDataSchema", () => {
		it("should validate valid crash data", () => {
			const validData = {
				type: "COLISÃO",
				description: "Colisão entre dois veículos",
				vehicles: {
					cars: 2,
					motorcycles: 0,
					bicycles: 0,
					cyclists: 0,
					pedestrians: 0,
				},
			};

			const result = crashDataSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it("should accept empty crash data", () => {
			const result = crashDataSchema.safeParse({});
			expect(result.success).toBe(true);
		});

		it("should reject negative vehicle counts", () => {
			const invalidData = {
				vehicles: {
					cars: -1,
				},
			};

			const result = crashDataSchema.safeParse(invalidData);
			expect(result.success).toBe(false);
		});
	});

	describe("environmentalDataSchema", () => {
		it("should validate environmental data", () => {
			const validData = {
				weather: "clear",
				traffic_light_status: "working",
				road_conditions: "good",
			};

			const result = environmentalDataSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});

		it("should accept undefined", () => {
			const result = environmentalDataSchema.safeParse(undefined);
			expect(result.success).toBe(true);
		});
	});

	describe("metadataSchema", () => {
		it("should validate metadata", () => {
			const validData = {
				original_id: "ABC123",
				protocol: "PROT-2023-001",
				verified: true,
				notes: "Verified by officer",
			};

			const result = metadataSchema.safeParse(validData);
			expect(result.success).toBe(true);
		});
	});

	describe("selectTrafficCallSchema", () => {
		it("should validate complete traffic call", () => {
			const validCall = {
				id: 1,
				datetime: new Date("2023-01-15T10:30:00Z"),
				nature: "COLISÃO",
				total_victims: 2,
				injured_victims: 1,
				fatal_victims: 0,
				street_name: "Rua da Consolação",
				neighborhood: "BOA VIAGEM",
				coordinates: "-8.1234,-34.5678",
				crash_data: { type: "COLISÃO" },
				environmental_data: { weather: "clear" },
				metadata: { verified: true },
				created_at: new Date(),
				updated_at: new Date(),
			};

			const result = selectTrafficCallSchema.safeParse(validCall);
			expect(result.success).toBe(true);
		});
	});

	describe("insertTrafficCallSchema", () => {
		it("should validate new traffic call data", () => {
			const newCall = {
				datetime: new Date("2023-01-15T10:30:00Z"),
				nature: "COLISÃO",
				total_victims: 2,
				injured_victims: 1,
				fatal_victims: 0,
				street_name: "Rua da Consolação",
				neighborhood: "BOA VIAGEM",
				coordinates: "-8.1234,-34.5678",
				crash_data: { type: "COLISÃO" },
			};

			const result = insertTrafficCallSchema.safeParse(newCall);
			expect(result.success).toBe(true);
		});

		it("should require essential fields", () => {
			const incompleteCall = {
				nature: "COLISÃO",
			};

			const result = insertTrafficCallSchema.safeParse(incompleteCall);
			expect(result.success).toBe(false);
		});
	});
});
