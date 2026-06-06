# Análise de Deploy — Branch `traffic-violations-try`

**Data**: 2026-06-04
**Branch**: `traffic-violations-try` (227 commits à frente de `main`)
**App foco**: `@atlas/traffic-violations`

---

## 1. Alterações Realizadas

### 1.1 Schema do Banco (`packages/database/src/schemas/traffic-violations/schema.ts`)

| Mudança | Detalhe |
|---|---|
| `official_streets` → `street_codes` | Tabela enxuta derivada de `pcr_streets` — remove campos `transport_corridor`, `perimeter_road`, `neighborhood_code`, `neighborhood_name` |
| **Nova tabela** `traffic_violations_catalog` | Catálogo canônico de infrações com `known_variants` (text[]), `category`, `differentiation` — match por descrição, não por código |
| **Nova tabela** `description_corrections` | Mapeia descrições com encoding quebrado para versões corrigidas |
| **Nova tabela** `traffic_violations_locations` | Registro canônico de localizações de infração (substitui `dict_locais_v2.json`) |
| **Nova tabela** `traffic_equipment` | Equipamentos de fiscalização/monitoramento da PCR |
| `traffic_violations` colunas | `violation_code` → `cttu_code`, remove `violation_type_id`, `coordinates`, `complementary_data`, adiciona FK `violation_id` → `traffic_violations_catalog` |
| `violation_categories` colunas | `violation_code` → `cttu_code` |
| `location_street_matches` colunas | FK aponta para `street_codes`, adiciona `is_new`, `created_by` |
| `officialStreetsRelations` → `streetCodesRelations` | Adicionada relação com `trafficEquipment` |
| Novas relações | `trafficViolations` ↔ `trafficViolationsCatalog`, `trafficViolationsLocations` ↔ `locationStreetMatches` |
| Zod schemas + tipos | Adicionados para `streetCodes`, `trafficViolationsCatalog`, `descriptionCorrections`, `trafficViolationsLocations`, `trafficEquipment`; removidos `officialStreets` |

### 1.2 Migrations do Pacote Compartilhado (`packages/database/src/migrations/`)

13 migrations no journal (0000–0013), **gap na 0011** (pula de 0010 para 0012).

| # | Nome | Descrição |
|---|---|---|
| 0000 | `new_silhouette` | Snapshot inicial (todas as tabelas) |
| 0001 | `magenta_owl` | Ajustes iniciais |
| 0002 | `shiny_pestilence` | Tabelas adicionais |
| 0003 | `stormy_sway` | Ajustes |
| 0004 | `outstanding_kid_colt` | Ajustes |
| 0005 | `remarkable_inhumans` | Ajustes |
| 0006 | `slim_cyclops` | Adiciona `city_id` em `ciclomapa_infra` |
| 0007 | `clean_duplicates` | Limpa duplicatas e adiciona UNIQUE em tabelas cycling-infra |
| 0008 | `remove_ciclomapa` | Remove tabela ciclomapa legada |
| 0009 | `raving_goldbug` | Ajustes |
| 0010 | `link_emergency_calls_pcr_streets` | FK `pcr_street_id` em emergency_calls |
| **0011** | **(gap — não existe)** | — |
| 0012 | `add_execution_columns` | Adiciona `executed`, `liquidated`, `paid` em `recife_budget_actions` |
| 0013 | `drop_official_streets` | **DROP TABLE official_streets CASCADE**, cria `street_codes` a partir de `pcr_streets`, recria FKs |

### 1.3 Migrations do App (`apps/traffic-violations/src/db/migrations/`)

**Journal vazio** (`entries: []`) — as migrations nunca foram registradas/trackeadas pelo drizzle-kit.

| # | Arquivo | Descrição |
|---|---|---|
| 0000 | `add_traffic_locations_equipment.sql` | Cria tabelas de localização e equipamento |
| 0001 | `seed_traffic_locations.sql` | Seed de dados de localização |
| 0002 | `add_traffic_violations_catalog.sql` | Cria `traffic_violations_catalog` (versão inicial, substituída pela 0003) |
| 0003 | `rebuilt_traffic_violations_catalog.sql` | **346 linhas** — DROP antigo, CREATE novo, INSERT ~200 infrações, UPDATE backfill `violation_id` |

### 1.4 API / Handlers

| Arquivo | Mudanças |
|---|---|
| `dashboard.handlers.ts` | `violation_code` → `cttu_code`, `infraction_catalog` → `traffic_violations_catalog`, match de categoria só por `description = ANY(known_variants)` (sem `violation_code`) |
| `streets.handlers.ts` | Remove filtro `violation_type_id`, agrupa top por `description`, `type_id` → `description` nas respostas |
| `streets.routes.ts` | Remove `violation_type_id` do query schema e response schema |
| `summary.handlers.ts` | Remove `violation_type_id` de todos os endpoints, agrupa por `description` |
| `summary.routes.ts` | Remove `violation_type_id` do query schema, remove `violation_type_id` do response schema |
| `violations.handlers.ts` | Remove filtro `violation_type_id` e `coordinates` das queries/respostas |
| `violations.routes.ts` | Remove `violation_type_id` do query, remove `coordinates` do response |
| `query-helpers.ts` | Remove definição runtime de `infractionCatalog`, usa `trafficViolationsCatalog` importado, category match por description |

### 1.5 Seeders

| Arquivo | Mudanças |
|---|---|
| `seed-official-streets.ts` | **Deletado** (substituído pela migration 0013) |
| `seed.ts` | Remove etapa "Official Streets" do pipeline master |
| `seed-traffic-violations.ts` | Adaptado: `violation_code` → `cttu_code`, `officialStreets` → `streetCodes`, remove `coordinates`/`complementary_data` |
| `seed-catalog.ts` | Reescrito — lê CSV único (`infrações - Página1.csv`), popula `traffic_violations_catalog`, faz `UPDATE` de backfill de `violation_id` e `description` nas violations |

---

## 2. Dificuldades para Subir em Produção

### 2.1 ⚠️ Duas fontes de Migrations (risco alto)

- O app tem `drizzle.config.ts` + `migrate.ts` próprio que roda de `apps/traffic-violations/src/db/migrations/`
- O pacote compartilhado tem seu próprio `drizzle.config.ts` + `migrate.ts` que roda de `packages/database/src/migrations/`
- **O deploy CI/CD (`deploy.yml`) só roda as do pacote compartilhado**: `node packages/database/dist/migrate.js`
- As migrations do app (0002 e 0003 — criação do catálogo e backfill) **NUNCA seriam executadas em produção** sem uma etapa extra

### 2.2 ⚠️ Migration 0013 é destrutiva

```sql
DROP TABLE official_streets CASCADE;
```

- Se `official_streets` tem dados em produção, serão perdidos
- FKs de outras tabelas que referenciam `official_streets` também caem (CASCADE)
- Só depois recria `street_codes` e as FKs — a janela entre DROP e CREATE deixa o schema inconsistente

### 2.3 ⚠️ App não está no Deploy Matrix

`deploy.yml` linha 61-64 — o matrix inclui apenas:
```
cyclist-profile, cyclist-counts, traffic-deaths, docs
```

**`traffic-violations` NÃO está listado.** Mesmo que o Docker build funcione, o deploy via Portainer nunca será triggerado.

Também não está na lista `API_APPS` (linha 108) que decide se migrations rodam.

### 2.4 ⚠️ Gap na migration 0011

O journal salta de `0010` para `0012`. Se o drizzle-kit espera sequência contínua, pode falhar ao aplicar.

### 2.5 ⚠️ Journal do app vazio vs migrations existentes

O `apps/traffic-violations/src/db/migrations/meta/_journal.json` tem `entries: []` mas existem 4 arquivos `.sql`. O drizzle-kit não sabe que elas existem. Ao rodar o migrate do app pela primeira vez, tentará aplicar todas — e se as tabelas já existirem (criadas pelo pacote compartilhado), haverá conflito.

### 2.6 ⚠️ Backfill pesado no seed-catalog

O `seed-catalog.ts` faz:
```sql
UPDATE traffic_violations SET violation_id = NULL;
-- depois um UPDATE com JOIN em traffic_violations_catalog
```

Em produção, se a tabela `traffic_violations` tiver **milhões de linhas**, esse update será lento e bloqueará leituras. Deve ser testado com volume real.

### 2.7 Dockerfile copia migrations do app

Linha 69 do Dockerfile:
```dockerfile
COPY --from=builder /app/apps/traffic-violations/src/db/migrations ./apps/traffic-violations/src/db/migrations
```

Mas o deploy CI/CD não usa essas migrations. O docker-compose standalone do app tem serviço `migrate` que as usa. É preciso decidir: usar as do pacote compartilhado (CI/CD) ou manter as do app (docker-compose standalone).

---

## 3. O que Necessita de Ajustes

| # | Item | Ação | Prioridade |
|---|---|---|---|
| 1 | **Consolidar migrations** | Mover migrations do app para o pacote compartilhado ou eliminar `drizzle.config.ts` do app | 🔴 Alta |
| 2 | **Adicionar ao deploy matrix** | Incluir `traffic-violations` no `deploy.yml` + criar webhook no Portainer | 🔴 Alta |
| 3 | **Corrigir gap 0011** | Criar migration 0011 placeholder ou renumerar 0012/0013 | 🟡 Média |
| 4 | **Testar migration 0013** | Validar em staging se há dados em `official_streets` que seriam perdidos | 🔴 Alta |
| 5 | **Testar backfill** | Rodar `seed-catalog` contra volume de dados real para medir tempo | 🟡 Média |
| 6 | **Alinhar Dockerfile** | Remover cópia de migrations do app se for usar só as do pacote compartilhado | 🟡 Média |
| 7 | **Configurar secrets** | `DATABASE_URL` de produção, `PORTAINER_WEBHOOK_TRAFFIC_VIOLATIONS` | 🔴 Alta |
| 8 | **Rodar testes** | `schema.spec.ts`, `traffic-violations.spec.ts`, `violations.integration.spec.ts` | 🟡 Média |

---

## 4. O que Já Está Concretizável

- Schema Drizzle completo e consistente (todas as tabelas, relações, tipos Zod)
- API implementada com todos os handlers adaptados ao novo schema
- Seeders prontos (`seed-traffic-violations.ts`, `seed-catalog.ts`)
- Dockerfile funcional (multi-stage build com turbo prune)
- `docker-compose.yml` standalone funcional (app + postgres + migrate + seed)
- CI de build Docker (`docker.yml`) já detecta mudanças em qualquer app com Dockerfile automaticamente
- Infra de deploy (Portainer + webhooks + GitHub Actions) já existe — só falta configurar o serviço
- Documentação de deploy completa (`deployment/README.md`, `DEPLOYMENT_CHECKLIST.md`, `MIGRATION_STRATEGY.md`)

---

## 5. Possibilidade de Remover/Refazer Migrações (Menos Migrações)

### Situação atual

```
Apps (4 migrations, journal vazio):
  0000_add_traffic_locations_equipment.sql
  0001_seed_traffic_locations.sql
  0002_add_traffic_violations_catalog.sql        ← redundante (0003 recria tudo)
  0003_rebuild_traffic_violations_catalog.sql    ← 346 linhas, faz DROP + CREATE + INSERT + UPDATE

Pacote compartilhado (13 migrations, 0000-0013):
  0006, 0007, 0008, 0009, 0010, 0012, 0013      ← novas vs main
  gap na 0011
```

### Recomendação: Consolidar + Squash

Como **`traffic-violations` nunca foi deployed**, podemos zerar e recriar limpo:

1. **Eliminar completamente o `drizzle.config.ts` e a pasta `migrations/` do app**
2. **Consolidar tudo no pacote compartilhado** — as tabelas `traffic_violations_locations`, `traffic_equipment`, `traffic_violations_catalog` já estão no schema; só faltam as migrations correspondentes no pacote
3. **Squash das 4 migrations do app em 2 migrations no pacote compartilhado:**

```
0014_create_traffic_locations_equipment.sql    ← equivalente ao 0000 do app
0015_seed_traffic_catalog.sql                  ← equivalente ao 0001+0002+0003 do app
```

4. **Migration 0002 do app pode ser descartada** — é redundante já que a 0003 recria a tabela do zero
5. **Corrigir gap 0011** — renumerar 0012 → 0011, 0013 → 0012, novas → 0013+

### Resultado
- **De ~10 migrations (4 app + 6 pacote) para ~8 migrations limpas e sequenciais**
- Apenas uma fonte de verdade para o schema (pacote compartilhado)
- Deploy CI/CD funcional sem etapas extras

### Alternativa: Snapshot limpo

Se o banco de produção para `traffic-violations` for **totalmente novo** (sem dados), pode-se:
1. Dropar todas as migrations existentes
2. Gerar um snapshot novo (`drizzle-kit generate`) com o schema atual
3. Ter **1 única migration** (snapshot inicial) + migrations incrementais futuras

---

## 6. Passos para Colocar Online

### Passo 1: Preparar o Código

```bash
# 1.1 Consolidar migrations no pacote compartilhado
#     - Criar 0014_create_traffic_locations_equipment.sql (baseado no 0000 do app)
#     - Criar 0015_seed_traffic_catalog.sql (baseado no 0001+0003 do app)
#     - Corrigir gap 0011 (renumerar 0012 → 0011, 0013 → 0012)

# 1.2 Remover drizzle.config.ts + pasta migrations/ do app
rm apps/traffic-violations/drizzle.config.ts
rm -rf apps/traffic-violations/src/db/migrations/

# 1.3 Remover cópia de migrations do Dockerfile (linha 69)

# 1.4 Rodar testes
pnpm --filter @atlas/traffic-violations test

# 1.5 Rodar build
pnpm --filter @atlas/traffic-violations build
pnpm --filter @atlas/database build

# 1.6 Testar migrations localmente
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlas_dev \
  node packages/database/dist/migrate.js
```

### Passo 2: Preparar CI/CD

```bash
# 2.1 Editar .github/workflows/deploy.yml:

# Na lista ALL_APPS (linha 61-64), adicionar:
#   {"app": "traffic-violations", "webhook_secret": "PORTAINER_WEBHOOK_TRAFFIC_VIOLATIONS", "service": "atlas-traffic-violations"}

# Na lista API_APPS (linha 108), adicionar "traffic-violations":
#   API_APPS='["cyclist-counts", "cyclist-profile", "traffic-deaths", "traffic-violations"]'
```

### Passo 3: Configurar Produção (Portainer)

```bash
# 3.1 No Portainer UI, criar um novo container/serviço:
#     - Name: atlas-traffic-violations
#     - Image: ghcr.io/ameciclo/atlas/traffic-violations:latest
#     - Port: 3013
#     - Network: kong-gateway_kong-net (ou atlas-network)
#     - Environment:
#         NODE_ENV=production
#         LOG_LEVEL=info
#         PORT=3013
#         DATABASE_URL=postgresql://user:pass@host:5432/atlas?sslmode=require

# 3.2 Habilitar webhook do serviço e copiar a URL

# 3.3 Adicionar secret no GitHub:
#     Settings → Secrets and variables → Actions → New repository secret
#     Name: PORTAINER_WEBHOOK_TRAFFIC_VIOLATIONS
#     Value: <url copiada do Portainer>
```

### Passo 4: Subir Dados (Seed)

```bash
# Opção A: Rodar seed diretamente contra o banco de produção
DATABASE_URL=postgresql://user:pass@host:5432/atlas?sslmode=require \
  node packages/database/dist/seed.js --only=violations

# Opção B: Via docker-compose standalone (se banco estiver acessível)
DATABASE_URL=<url> docker compose -f apps/traffic-violations/docker-compose.yml \
  --profile with-seed up seed

# Opção C: Seed + catalog pipeline
node apps/traffic-violations/dist/db/seed-catalog.js   # popula catalog + backfill
node apps/traffic-violations/dist/db/seed.js           # seed de violations
```

### Passo 5: Merge e Deploy

```bash
# 5.1 Fazer commit das correções
git add -A
git commit -m "fix: consolidate migrations, add traffic-violations to deploy matrix"

# 5.2 Merge no main
git checkout main
git merge traffic-violations-try
git push origin main

# 5.3 O GitHub Actions fará automaticamente:
#     1. docker.yml: Build da imagem Docker e push para GHCR
#     2. deploy.yml: Rodar migrations contra o banco de produção
#     3. deploy.yml: Trigger do webhook do Portainer
#     4. Portainer: Pull da nova imagem e restart do container
```

### Passo 6: Verificar

```bash
# 6.1 Health check
curl https://api.seu-dominio.com/traffic-violations/health

# 6.2 Testar endpoints
curl https://api.seu-dominio.com/traffic-violations/v1/dashboard/overview
curl https://api.seu-dominio.com/traffic-violations/v1/streets/ranking
curl https://api.seu-dominio.com/traffic-violations/v1/violations/summary

# 6.3 Verificar logs no Portainer
```

---

## Resumo dos Riscos (Checklist Antes do Deploy)

- [ ] **Migration 0013 é destrutiva** — verificar se `official_streets` tem dados em produção que não podem ser perdidos
- [ ] **Duas fontes de migrations** — consolidar no pacote compartilhado antes de subir
- [ ] **App não está no deploy matrix** — adicionar ao `deploy.yml` e configurar webhook
- [ ] **Gap na 0011** — corrigir numeração
- [ ] **Journal do app vazio** — remover drizzle.config do app ou sincronizar journal
- [ ] **Backfill no seed-catalog** — testar performance com volume real de dados
- [ ] **Testes passando** — `pnpm --filter @atlas/traffic-violations test`
- [ ] **Build funcionando** — `pnpm --filter @atlas/traffic-violations build`
- [ ] **Secrets configurados** — `DATABASE_URL`, `PORTAINER_WEBHOOK_TRAFFIC_VIOLATIONS` no GitHub
- [ ] **Variáveis de ambiente** — `NODE_ENV=production`, `LOG_LEVEL=info`, `PORT=3013`, SSL no DATABASE_URL
