# 📋 Guia: Criando um Novo Serviço de Banco de Dados + API no Atlas

Este guia documenta todos os passos necessários para criar um novo serviço completo no Atlas, baseado na experiência de criação do serviço `cyclists-count`.

## 1. **Scaffolding Inicial**

```bash
# Usar a ferramenta de scaffolding do Atlas
pnpm create-atlas-app nome-do-servico
```

O scaffolding já cria a estrutura básica com TypeScript, Hono, Zod OpenAPI, Docker e configurações de CI/CD.

## 2. **Configuração do Banco de Dados**

### Schema (`src/db/schema.ts`)

```typescript
import {
	geometry,
	index,
	integer,
	jsonb,
	pgTable,
	timestamp,
} from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";

export const minhaTabela = pgTable(
	"minha_tabela",
	{
		id: integer("id").primaryKey(),
		data: jsonb("data").notNull(),
		metadata: jsonb("metadata").notNull(),
		coordinates: geometry("coordinates", {
			type: "point",
			mode: "xy",
			srid: 4326,
		}),
		created_at: timestamp("created_at").defaultNow().notNull(),
		updated_at: timestamp("updated_at").defaultNow().notNull(),
	},
	(t) => [index("spatial_index").using("gist", t.coordinates)],
);

export const selectSchema = createSelectSchema(minhaTabela);
export type MeuTipo = typeof minhaTabela.$inferSelect;
```

### Configuração Drizzle (`drizzle.config.ts`)

```typescript
import { defineConfig } from "drizzle-kit";
import { env } from "./src/env.js";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	dbCredentials: { url: env.DATABASE_URL },
});
```

## 3. **Dados e Seed**

### Arquivo de dados (`src/db/meus_dados.json`)

Estrutura recomendada seguindo o padrão data/metadata:

```json
[
	{
		"id": 1,
		"data": {
			"sessions": [
				{
					"total_count": 42,
					"directions": {...}
				}
			]
		},
		"metadata": {
			"location_name": "Nome do Local",
			"date": "2025-01-14",
			"researcher": "Nome do Pesquisador"
		},
		"coordinates": {
			"x": -34.8851,
			"y": -8.1137
		}
	}
]
```

### Script de seed (`src/db/seed.ts`)

```typescript
import { db } from "./index.js";
import { minhaTabela } from "./schema.js";
import dados from "./meus_dados.json";

const seed = async () => {
	console.log("Starting seed...");
	
	await db.insert(minhaTabela).values(dados);
	
	console.log(`Seed completed! Inserted ${dados.length} records.`);
	process.exit(0);
};

seed().catch((error) => {
	console.error("Seed failed:", error);
	process.exit(1);
});
```

## 4. **API Routes**

### Estrutura de rotas (`src/routes/exemplo/`)

- `exemplo.routes.ts` - Definições OpenAPI com Zod
- `exemplo.handlers.ts` - Lógica dos handlers
- `exemplo.index.ts` - Assembly do router

### Routes (`exemplo.routes.ts`)

```typescript
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { selectSchema } from "../../db/schema.js";

const tags = ["Meu Serviço"];

export const list = createRoute({
	path: "/v1/meu-endpoint",
	method: "get",
	tags,
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			z.array(selectSchema),
			"Lista de dados",
		),
	},
});

export const getById = createRoute({
	path: "/v1/meu-endpoint/{id}",
	method: "get",
	tags,
	request: {
		params: z.object({
			id: z.string().transform(Number),
		}),
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(
			selectSchema,
			"Dados por ID",
		),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(
			z.object({ message: z.string() }),
			"Dados não encontrados",
		),
	},
});

export type ListRoute = typeof list;
export type GetByIdRoute = typeof getById;
```

### Handlers (`exemplo.handlers.ts`)

```typescript
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { minhaTabela } from "../../db/schema.js";
import type { AppRouteHandler } from "../../lib/types.js";
import type * as routes from "./exemplo.routes.js";

export const list: AppRouteHandler<routes.ListRoute> = async (c) => {
	const dados = await db.select().from(minhaTabela);
	return c.json(dados);
};

export const getById: AppRouteHandler<routes.GetByIdRoute> = async (c) => {
	const { id } = c.req.valid("param");
	const resultado = await db
		.select()
		.from(minhaTabela)
		.where(eq(minhaTabela.id, id));

	if (resultado.length === 0) {
		return c.json({ message: "Dados não encontrados" }, 404);
	}

	return c.json(resultado[0]);
};
```

### Router Assembly (`exemplo.index.ts`)

```typescript
import { createRouter } from "../../lib/create-app.js";
import * as handlers from "./exemplo.handlers.js";
import * as routes from "./exemplo.routes.js";

const router = createRouter()
	.openapi(routes.list, handlers.list)
	.openapi(routes.getById, handlers.getById);

export default router;
```

## 5. **Testes**

### Arquivo de teste (`test/meu-servico.spec.ts`)

```typescript
import { testClient } from "hono/testing";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import app from "../src/app.js";
import { db } from "../src/db/index.js";
import type { MeuTipo } from "../src/db/schema.js";

// Mock database methods
const execute = vi.spyOn(db, "execute");
const select = vi.spyOn(db, "select");

beforeAll(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2025-01-14T12:00:00.000Z"));
});

afterAll(() => {
	vi.useRealTimers();
});

describe("GET /v1/meu-endpoint", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	it("200 → empty array if no data", async () => {
		select.mockReturnValue({
			from: vi.fn().mockResolvedValue([]),
		} as ReturnType<typeof db.select>);

		const res = await app.request("/v1/meu-endpoint");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual([]);
	});

	it("200 → returns data", async () => {
		const fakeDate = new Date();
		const fake: MeuTipo[] = [
			{
				id: 1,
				data: { test: "data" },
				metadata: { location_name: "Test Location" },
				coordinates: { x: -34.8851, y: -8.1137 },
				created_at: fakeDate,
				updated_at: fakeDate,
			},
		];

		select.mockReturnValue({
			from: vi.fn().mockResolvedValue(fake),
		} as ReturnType<typeof db.select>);

		const res = await app.request("/v1/meu-endpoint");
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual(
			fake.map((r) => ({
				...r,
				created_at: fakeDate.toISOString(),
				updated_at: fakeDate.toISOString(),
			})),
		);
	});
});
```

## 6. **Configuração de Ambiente**

### Variáveis (`.env`)

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
PORT=3003
NODE_ENV=development
```

### Exemplo (`.env.example`)

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/database_name
PORT=3003
NODE_ENV=development
```

## 7. **Docker**

O Dockerfile e docker-compose.yml são gerados automaticamente pelo scaffolding e já incluem:

- Multi-stage build
- PostgreSQL com PostGIS
- Configurações de produção
- Scripts de migração e seed

## 8. **Integração no App Principal**

### Registrar rotas (`src/app.ts`)

```typescript
import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import meuRouter from "./routes/exemplo/exemplo.index.js";

const app = createApp()
	.route("/", healthRoutes)
	.route("/", meuRouter);

export default app;
```

## 9. **Comandos de Desenvolvimento**

```bash
# Instalar dependências
pnpm install

# Executar migrações
pnpm --filter @atlas/meu-servico db:migrate

# Executar seed
pnpm --filter @atlas/meu-servico db:seed

# Desenvolvimento
pnpm --filter @atlas/meu-servico dev

# Testes
pnpm --filter @atlas/meu-servico test

# Build
pnpm --filter @atlas/meu-servico build

# Gerar OpenAPI spec
pnpm --filter @atlas/meu-servico generate-openapi
```

## 10. **Qualidade de Código**

```bash
# Formatação automática
pnpm format --write

# Verificar lint
pnpm lint

# Verificar tipos
pnpm check-types
```

### Configuração do VS Code

Instale a extensão **Biome** (`biomejs.biome`) e configure:

```json
{
	"editor.defaultFormatter": "biomejs.biome",
	"editor.formatOnSave": true,
	"editor.codeActionsOnSave": {
		"quickfix.biome": "explicit",
		"source.organizeImports.biome": "explicit"
	}
}
```

## 🎯 **Pontos-Chave Aprendidos**

### Tecnologias Utilizadas

1. **PostGIS**: Usar `geometry` para coordenadas geográficas com índice espacial
2. **JSONB**: Para dados flexíveis seguindo padrão data/metadata
3. **Zod OpenAPI**: Validação de tipos + documentação automática
4. **Drizzle ORM**: Operações type-safe no banco de dados
5. **Vitest**: Testes com mocks adequados (evitar `as any`)
6. **Biome**: Formatação consistente (tabs, não espaços)
7. **Hono**: Framework web rápido e type-safe

### Padrões do Projeto

- **Estrutura data/metadata**: Separar dados principais de metadados
- **Coordenadas PostGIS**: Usar SRID 4326 para GPS
- **Testes**: Mock database com tipos corretos
- **OpenAPI**: Documentação automática via Zod schemas
- **Monorepo**: Usar filtros pnpm para comandos específicos

### CI/CD Automático

O projeto já inclui:
- ✅ Build automático no GitHub Actions
- ✅ Deploy via Docker containers
- ✅ Geração automática de documentação OpenAPI
- ✅ Testes automatizados
- ✅ Verificação de qualidade de código

## 📚 **Próximos Passos**

1. Seguir este guia para criar novos serviços
2. Adaptar schemas conforme necessidade dos dados
3. Implementar endpoints específicos do domínio
4. Adicionar testes abrangentes
5. Documentar APIs via OpenAPI

Este guia garante consistência e qualidade em todos os novos serviços do Atlas! 🚀