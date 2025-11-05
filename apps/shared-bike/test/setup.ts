import { beforeAll, afterAll } from "vitest";
import "dotenv/config";

// Setup global para todos os testes
beforeAll(async () => {
	// Configurações globais de teste
	process.env.NODE_ENV = "test";
});

afterAll(async () => {
	// Cleanup global
});