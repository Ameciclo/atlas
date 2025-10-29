import { vi } from "vitest";

// Mock environment variables for tests
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test_db?sslmode=disable";

// Mock database connection for integration tests
vi.mock("../src/db/index.js", () => ({
	db: {
		query: {
			geolocatedCrashes: {
				findMany: vi.fn().mockResolvedValue([]),
				findFirst: vi.fn().mockResolvedValue(null),
			},
		},
	},
}));