# Análise de Arquitetura — Atlas

## Visão Geral

O **Atlas** é um **monorepo** gerenciado com **pnpm workspaces + Turborepo**, contendo **14 apps** em `apps/` e **4 pacotes compartilhados** em `packages/`. A stack é **Hono + Zod OpenAPI + Drizzle ORM + PostgreSQL 16 + PostGIS**.

---

## Estrutura Padrão dos Apps

11 dos 14 apps seguem uma estrutura idêntica de diretórios:

```
apps/<nome>/
  src/
    app.ts                 # Criação do app Hono, registro de rotas
    index.ts               # Entry point, inicia servidor HTTP
    env.ts                 # Variáveis de ambiente tipadas (zod)
    generate-openapi.ts    # Gerador de spec OpenAPI
    db/
      index.ts             # Conexão com banco (drizzle + pg)
      schema.ts            # Schema das tabelas
      seed.ts              # Seed data (opcional)
    lib/
      create-app.ts        # Factory do app (Hono + CORS + pino + OpenAPI)
      types.ts             # Type aliases (AppBindings, AppRouteHandler)
      constants.ts         # Constantes específicas do app
    middlewares/
      pino-logger.ts       # Middleware de log de requests
    routes/
      <dominio>/
        <dominio>.routes.ts      # Validação Zod + definições OpenAPI
        <dominio>.handlers.ts    # Handlers — TUDO MISTURADO AQUI
        <dominio>.index.ts       # Agrupamento de rotas
      health.ts             # Health check
  test/
    <tests>.spec.ts        # Testes Vitest
  Dockerfile               # Build Docker multi-stage
  package.json
  tsconfig.json
  vitest.config.ts
  .env / .env.example
```

**Apps que seguem este padrão exato (11):** `bicycle-racks`, `cyclist-counts`, `cyclist-profile`, `cycling-infra`, `emergency-calls`, `pcr-streets`, `shared-bike`, `traffic-calls`, `traffic-deaths`, `traffic-violations`, `docs`.

**Variações:**
- **`ciclodados`**: Não possui `db/`. Usa `lib/database.ts` + `lib/street-service.ts` (padrão de service class).
- **`recife-budget`** e **`state-budget`**: Stubs mínimos — sem código fonte ainda.
- **`docs`**: App React/Vite (não é API Hono).

---

## O Problema: Mistura de Responsabilidades nos Handlers

Em **10 dos 12 apps ativos de API**, os handlers concentram **5 responsabilidades no mesmo arquivo**:

1. **Validação de parâmetros HTTP** (`c.req.valid("query")`)
2. **Queries SQL/ORM** (`db.select().from(table).where(...)`)
3. **Lógica de negócio** (agregações, cálculos, transformações)
4. **Formatação de dados** (GeoJSON, estatísticas)
5. **Resposta HTTP** (status codes, estrutura JSON)

### Exemplo crítico 1: `bicycle-racks`

- **Arquivo:** `apps/bicycle-racks/src/routes/bicycle-racks.handlers.ts` — **268 linhas**
- **Problema:** O handler `list` contém queries SQL com joins espaciais PostGIS, filtros por bounding box, formatação GeoJSON, status HTTP — tudo inline, sem nenhuma camada de abstração.
- **Import direto do db:** `import { db } from "../db/index.js"`

```typescript
// Exemplo simplificado do padrão problemático:
import { db } from "../db/index.js";

export const list: AppRouteHandler<ListRoute> = async (c) => {
    // 1. Parâmetros HTTP
    const { bbox, limit } = c.req.valid("query");
    
    // 2. SQL inline
    const racks = await db.select().from(bicycleRacks)
        .where(and(...filtrosEspaciais));
    
    // 3. Lógica de negócio + formatação GeoJSON
    const features = racks.map(r => ({
        type: "Feature",
        geometry: JSON.parse(r.geometry),
        properties: { ... }
    }));
    
    // 4. Resposta HTTP
    return c.json({ type: "FeatureCollection", features }, 200);
};
```

### Exemplo crítico 2: `traffic-deaths`

- **Arquivo:** `apps/traffic-deaths/src/routes/summary/summary.handlers.ts` — **81 linhas**
- **Problema:** Cálculos complexos de sumário (agregações por ano, tipo, região) feitos inline no handler, com `db` importado diretamente.

### Exemplo crítico 3: `traffic-calls`, `emergency-calls`, `traffic-violations`

Todos seguem o mesmo padrão: handler com SQL bruto, sem service layer, sem repository pattern.

---

## O Único App Bem Separado: `ciclodados`

```
ciclodados/src/
  lib/
    street-service.ts    # StreetService class (363 linhas)
                         # Contém TODA lógica de DB e negócio
    database.ts          # Pool de conexão centralizado
  routes/
    streets/
      streets.handlers.ts        # Handler FINO (53 linhas) — só HTTP
      data-summary.handler.ts    # Handler FINO — só HTTP
```

Os handlers delegam para `StreetService` e só lidam com formatação de resposta HTTP:

```typescript
// Exemplo do padrão correto:
import { StreetService } from "../../lib/street-service.js";
const streetService = new StreetService();

export const searchStreets = async (c) => {
    const { q, limit } = c.req.valid("query");
    const matches = await streetService.searchStreets(q, limit);
    return c.json({ matches }, 200);  // Apenas HTTP aqui
};
```

---

## Separação Parcial: `cycling-infra`

```
cycling-infra/src/
  lib/
    queries.ts   # Funções exportadas: getExistingInfraKm(), getPdcPlannedKm(),
                 # getPdcWaysBreakdown(), getInfraPerCity(), getPdcRoutesForCity()
```

- Encapsula SQL complexo em funções exportadas (não como classe de serviço)
- As funções criam suas **próprias conexões** com `createConnectedDatabase()` ao invés de receber uma instância de db
- Handlers ainda chamam essas funções diretamente, sem uma camada de serviço intermediária

---

## Outros Problemas de Mistura de Responsabilidades

### Infraestrutura misturada com código fonte

| Artefato | Localização | Problema |
|---|---|---|
| `Dockerfile` | Dentro de cada `apps/<nome>/` | Infra de build junto com código fonte |
| `docker-compose.yml` | `apps/bicycle-racks/`, `apps/emergency-calls/`, `apps/traffic-calls/`, `apps/traffic-violations/` | Compose files específicos dentro dos apps |
| Arquivos de dados (GeoJSON, JSON) | `apps/bicycle-racks/src/db/bicicletarios-brasil.geojson`, `apps/cyclist-profile/src/db/cyclist_profiles.json` | Dados + código no mesmo diretório |

### Seed scripts espalhados

- `packages/database/src/seed-*.ts` — um arquivo de seed por app
- Referenciam schemas de múltiplos serviços (ex: `seed-cyclist-profiles.ts` referencia schema do `cyclist-profile`)
- Poderiam estar co-localizados com seus respectivos apps

### 4 padrões de conexão DB inconsistentes

| Padrão | Apps que usam | Abordagem |
|---|---|---|
| drizzle direto sem SSL | `bicycle-racks`, `traffic-deaths`, `pcr-streets`, etc. | `drizzle({connection: {connectionString: ...}})` |
| Client com SSL | `cyclist-profile` | `new Client({ssl: getSSLConfig()})` |
| Pool ao invés de Client | `ciclodados` | `new Pool()` |
| Função do pacote compartilhado | `cycling-infra` (queries.ts) | `createConnectedDatabase()` |

### Código repetido entre apps

- `create-app.ts` — quase idêntico em todos os apps, copiado individualmente
- `types.ts` — type aliases repetidos
- `pino-logger.ts` — middleware de log idêntico
- `env.ts` — validação de variáveis de ambiente duplicada

### Scaffolding perpetua o problema

- `packages/create-atlas-app/` gera o padrão com handlers misturados
- Todo app novo nasce com o problema de mistura de responsabilidades

---

## Estrutura do Pacote de Banco de Dados (`packages/database/`)

### Acoplamento forte

- Cada schema em `packages/database/src/schemas/<servico>/` exporta **3 coisas no mesmo arquivo `schema.ts`**:
  - Definições de tabela Drizzle
  - Schemas de validação Zod
  - TypeScript types
- O `package.json` do pacote `@atlas/database` exporta **11 subpaths individuais** de schema — acoplando fortemente o pacote ao conhecimento de cada tabela de cada app
- Banco único (`atlas`), schema único (`public`) — todas as tabelas no mesmo namespace

---

## Resumo por App

| App | Service Layer? | DB direto no handler? | Handler +200 linhas? | Dockerfile no app? | docker-compose no app? |
|---|---|---|---|---|---|
| `bicycle-racks` | Não | **Sim** | **Sim (268)** | Sim | Sim |
| `ciclodados` | **Sim (StreetService)** | Não | Não (53) | Sim | Não |
| `cycling-infra` | Parcial (queries.ts) | Sim | — | Sim | Não |
| `cyclist-counts` | Não | Sim | — | Sim | Não |
| `cyclist-profile` | Não | Sim | — | Sim | Não |
| `emergency-calls` | Não | Sim | — | Sim | Sim |
| `pcr-streets` | Não | Sim | — | Sim | Não |
| `shared-bike` | Não | Sim | — | Sim | Não |
| `traffic-calls` | Não | Sim | — | Sim | Sim |
| `traffic-deaths` | Não | Sim | **Sim (81)** | Sim | Não |
| `traffic-violations` | Não | Sim | — | Sim | Sim |
| `recife-budget` | N/A (stub) | N/A | N/A | Não | Não |
| `state-budget` | N/A (stub) | N/A | N/A | Não | Não |
| `docs` | N/A (React) | N/A | N/A | Sim | Não |

---

## Conclusão

A suspeita inicial se confirma: **10 dos 12 apps ativos de API misturam API, banco de dados e lógica de negócio nos handlers**. O único app que implementa separação adequada de responsabilidades é o **`ciclodados`** (com o padrão `StreetService`). O **`cycling-infra`** tem uma separação parcial via `queries.ts`.

### Recomendações de refatoração

1. **Extrair service layer** em cada app (seguindo o padrão do `ciclodados` como referência)
2. **Unificar conexão DB** (adotar `createConnectedDatabase()` do `@atlas/database` em todos os apps)
3. **Extrair código repetido** (`create-app.ts`, `types.ts`, `pino-logger.ts`) para um pacote compartilhado `@atlas/hono-utils` ou similar
4. **Atualizar o scaffolding** (`create-atlas-app`) para gerar o padrão com service layer
5. **Mover dados estáticos** (GeoJSON, JSON) para um diretório `data/` separado, fora de `src/`
6. **Co-localizar seeds** com seus respectivos apps
