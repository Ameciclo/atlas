import { vi } from "vitest";

// Mock pg so importing the dbMiddleware doesn't blow up in tests where
// the real connection is replaced via createTestApp(router, mockDb).
vi.mock("pg", () => {
	const Client = vi.fn().mockImplementation(() => ({
		connect: vi.fn().mockResolvedValue(undefined),
		query: vi.fn().mockResolvedValue({ rows: [] }),
		end: vi.fn().mockResolvedValue(undefined),
	}));
	return {
		default: { Client },
		Client,
	};
});
