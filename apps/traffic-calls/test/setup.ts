import { vi } from "vitest";

// Mock database connection to avoid external dependencies
vi.mock("../src/db/index.js", () => {
	const mockQuery = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue([]),
	};
	return {
		db: mockQuery,
	};
});

// Mock pg for health check
vi.mock("pg", () => ({
	Client: vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		query: vi.fn().mockResolvedValue({ rows: [] }),
		end: vi.fn().mockResolvedValue(undefined),
	})),
}));