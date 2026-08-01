// Re-export everything from the shared database schema
export * from "@atlas/database/schemas/emergency-calls";

// Also export for local use
export {
	emergencyCalls,
	selectEmergencyCallSchema,
} from "@atlas/database/schemas/emergency-calls";

export { pcrStreets } from "@atlas/database/schemas/pcr-streets";
