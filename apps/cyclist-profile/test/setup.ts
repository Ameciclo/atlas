import { vi } from "vitest";

// Mock the database module to prevent actual database connections during tests
vi.mock("../src/db/index.js", () => ({
	db: {
		query: {
			cyclistProfiles: {
				findMany: vi.fn(),
				findFirst: vi.fn(),
			},
		},
		insert: vi.fn(),
	},
}));
