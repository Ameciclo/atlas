# Traffic Violations — Estudo Completo do Projeto

> Gerado em 2026-05-31. Branch: `traffic-violations-try` (commit `cf1ec25`)

---

## Sumário

1. [Visão Geral](#1-visão-geral)
2. [Inventário de Arquivos](#2-inventário-de-arquivos)
3. [Esquema do Banco de Dados](#3-esquema-do-banco-de-dados)
4. [Fluxo de Dados (Raw → Banco)](#4-fluxo-de-dados-raw--banco)
5. [Sistema de Equivalência de Ruas (Matching)](#5-sistema-de-equivalência-de-ruas-matching)
6. [Classificação de Infrações (Categories)](#6-classificação-de-infrações-categories)
7. [API Endpoints × Tabelas](#7-api-endpoints--tabelas)
8. [Pendências e Problemas Conhecidos](#8-pendências-e-problemas-conhecidos)
9. [Recomendações](#9-recomendações)

---

## 1. Visão Geral

**App**: API REST em Hono.js + Drizzle ORM para dados de infrações de trânsito da cidade do Recife (PE).

**Volume atual**: ~2.2 milhões de registros em `traffic_violations`, de 2020 a 2025. Dados de outras fontes foram baixados (`all-infracoes/` com 15 arquivos, ~1.2 GB) mas ainda não passaram pelo seed.

**Porta**: 3013

**Scripts principais**:
| Script | Descrição |
|--------|-----------|
| `pnpm dev` | Sobe o servidor |
| `pnpm test` | Roda testes (vitest) |
| `pnpm lint` / `pnpm format` | Biome |
| `pnpm db:migrate` | Roda migrations Drizzle |
| `pnpm db:match` | Pipeline de matching de ruas |
| `pnpm db:seed` | Seed dummy (1 registro exemplo) — **não usado em produção** |
| `tsx src/db/seed-all.ts` | Pipeline completo de seed (categories + corrections) |
| `python3 src/db/etl-normalize.py --apply` | ETL de normalização dos dados brutos |

---

## 2. Inventário de Arquivos

### 2.1 Código Fonte (permanente)

| Arquivo | Função |
|---------|--------|
| `src/app.ts` | Config do app Hono |
| `src/index.ts` | Entry point do servidor |
| `src/env.ts` | Validação de variáveis de ambiente |
| `src/db/index.ts` | Conexão DB (drizzle + pg Pool) |
| `src/db/schema.ts` | Re-exports de schemas do pacote `@atlas/database` |
| `src/db/match-pipeline.ts` | Pipeline de matching de ruas (3 fases) |
| `src/lib/constants.ts` | Constantes da aplicação |
| `src/lib/create-app.ts` | Factory do app Hono com OpenAPI |
| `src/lib/match-orchestrator.ts` | Orquestrador de matching (expõe API interna) |
| `src/lib/query-helpers.ts` | Helpers de query (AGENT_INFO, buildConditions, resolveCategoryCodes) |
| `src/lib/street-matcher.ts` | Algoritmos de matching (exact, levenshtein, trigram) |
| `src/lib/street-normalizer.ts` | Normalização de endereços |
| `src/lib/types.ts` | Tipos compartilhados |
| `src/middlewares/pino-logger.ts` | Middleware de logging |
| `src/routes/health.ts` | Health check |
| `src/routes/dashboard/*` | 7 endpoints de dashboard |
| `src/routes/streets/*` | CRUD + ranking + summary + geojson + matching + validação |
| `src/routes/violations/*` | Listagem + summary (by-type, by-agent, temporal) |
| `src/generate-openapi.ts` | Gera `openapi.json` |
| `src/db/migrate.ts` | Runner de migrations |
| `src/db/migrations/0000_*.sql` | Migration DDL (cria `traffic_locations`, `traffic_equipment`) |

### 2.2 Scripts de Seed/ETL (permanentes)

| Arquivo | Função | Depende de |
|---------|--------|-----------|
| `src/db/seed-all.ts` | Orquestrador do seed completo | `seed-violation-categories.ts`, `seed-description-corrections.ts` |
| `src/db/seed-violation-categories.ts` | Popula `violation_categories` com classificação CTB | `tabela_infracoes_ctb_classificada_*.csv` |
| `src/db/seed-description-corrections.ts` | Corrige descrições truncadas/corrompidas | `descricoes_infracoes_corrigidas.csv` |
| `src/db/etl-normalize.py` | ETL Python: normaliza TSVs brutos → TSV unificado | `all-infracoes/*.tsv`, `dict_agentes_v2.json`, `dict_infracoes_v2.json`, `dict_locais_v2.json` |

### 2.3 Dados de Referência (permanentes, commitados)

| Arquivo | Tamanho | Função |
|---------|---------|--------|
| `src/db/dict_agentes_v2.json` | 373 B | Mapeamento código → agente (12 entradas) |
| `src/db/dict_infracoes_v2.json` | 109 KB | Mapeamento código+lei+desc → ID (876 entradas) |
| `src/db/dict_locais_v2.json` | **38 MB** | Dicionário base de locais (~568K entradas). Essencial pro ETL |
| `src/db/dict_variantes_ruas.json` | 4.6 KB | Regras de substituição de nomes de rua (194 variantes) |
| `src/db/dicionario_infracoes.csv` | 72 KB | Dicionário gerado (code, law, desc, category, total) |
| `src/db/descricoes_infracoes.csv` | 59 KB | Export do banco (violation_code, law_code, description) |
| `src/db/descricoes_infracoes_corrigidas.csv` | 113 KB | Versão corrigida manualmente (554 pares) |
| `src/db/tabela_infracoes_ctb_classificada_*.csv` | 44 KB | Tabela CTB oficial classificada (243 artigos) |
| `src/db/equipamentos-fiscalizacao.csv` | 14 KB | Equipamentos de fiscalização |
| `src/db/equipamentos-monitoramento.csv` | 4 KB | Equipamentos de monitoramento |
| `src/db/logradouros-bairro.tsv` | 1.3 MB | Mapeamento logradouro → bairro (11.9K ruas) |

### 2.4 Dados Brutos (gitignored — NÃO commitados)

| Arquivo/Diretório | Tamanho | Status |
|-------------------|---------|--------|
| `src/db/all-infracoes/*.tsv` (15 arquivos) | **~1.2 GB** | Fonte raw do ETL. Gitignored |
| `src/db/infracoes_reduzido_v2.tsv` | 72 MB | Output do ETL (2.2M linhas). Gitignored |
| `src/db/dict_locais_v3.json` | 42 MB | Output do ETL. Gitignored |
| `src/db/enderecos_otimizado.csv` | 43 MB | Endereços com códigos de rua. Gitignored |
| `src/db/Trechos de Logradouros.geojson` | 15 MB | Geometria PCR. Gitignored |
| `src/db/Logradouros por face de quadra.csv` | 27 MB | Logradouros PCR. Gitignored |
| `src/db/migrations/0001_seed_traffic_locations.sql` | 6.7 MB | Gerado pelo ETL. Gitignored |

### 2.5 Scripts Descartáveis

| Arquivo | Função | Status |
|---------|--------|--------|
| `src/db/export-descriptions-csv.ts` | Exporta `descricoes_infracoes.csv` do banco | Já cumpriu função, manter como referência |
| `src/db/generate-dictionary-csv.ts` | Gera `dicionario_infracoes.csv` com pré-classificação | Já cumpriu função, manter como referência |
| `src/db/seed.ts` | Seed dummy (1 registro exemplo) | **Nunca usado em produção**. Pode remover |
| `src/db/random-queries.sql` | Queries de validação manual | Debug, pode manter |

### 2.6 Arquivos Commitados que Deveriam Ser Removidos do Git

| Arquivo | Tamanho | Motivo |
|---------|---------|--------|
| `src/db/infracoes_reduzido.tsv` | 88 MB | Está gitignored (`infracoes_reduzido*.tsv`) mas foi commitado antes. **Remover com `git rm --cached`** |
| `src/db/enderecos_otimizado.csv` | 43 MB | Idem. **Remover com `git rm --cached`** |
| `openapi.json` | 114 KB | Gerado, gitignore root cobre mas já estava tracked. **Remover com `git rm --cached`** |

---

## 3. Esquema do Banco de Dados

### 3.1 Tabelas

```
┌─────────────────────────────────────────────────────────────────────┐
│                         pcr_streets                                  │
│  Fonte bruta PCR: object_id, clogra_codi, nlogra_conc,              │
│  nlgpav_ofic, nlgpav_resu, db2gse_sde (comprimento),                │
│  coordinates (PostGIS geometry)                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│  RELAÇÃO LÓGICA (ETL/seed): clogra_codi = street_codes.code         │
│  NÃO há FK formal entre os schemas.                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ (lógico)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         street_codes                                 │
│  Catálogo canônico: code (UNIQUE), official_name, short_name,       │
│  name_concatenated, pavement_code/description                        │
│  ~11.922 ruas                                                        │
└──────┬────────────────────┬────────────────────┬────────────────────┘
       │ FK                 │ FK                 │ FK
       ▼                    ▼                    ▼
┌──────────────┐  ┌─────────────────────┐  ┌──────────────────┐
│ traffic_     │  │ location_street_    │  │ traffic_         │
│ violations   │  │ matches             │  │ equipment        │
│              │  │                     │  │                  │
│ street_code──┘  │ matched_street_code─┘  │ street_code──────┘
│              │  │                     │  │                  │
│ location_id──┼──┤ location_id (UNIQUE)│  │ equipment_type   │
│  (lógico)    │  │ match_method        │  │ identification   │
│              │  │ match_confidence    │  │ local_instalacao │
│ violation_   │  │ needs_validation    │  │ latitude/long..  │
│   code ──────┼──┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─│  │                  │
│ law_code     │  │ validation_status   │  └──────────────────┘
│ description  │  │ alternative_cand... │
│ agent_id     │  │ normalized_data     │
│ violation_   │  └─────────────────────┘
│   date       │           │ (1:1 lógico)
│ coordinates  │           ▼
│ compl._data  │  ┌─────────────────────┐
└──────┬───────┘  │ traffic_locations   │
       │          │                     │
       │ (lógico) │ location_id (UNIQUE)│
       │          │ raw_description     │
       │          │ extracted_street    │
       │          │ street_type         │
       │          │ semaphore_number    │
       │          │ address_number      │
       │          │ reference_point     │
       │          │ direction           │
       │          │ is_new, source_year │
       │          └─────────────────────┘
       │
       │ (lógico, JOIN via violation_code)
       ▼
┌──────────────────────┐    ┌──────────────────────────┐
│ violation_categories │    │ description_corrections  │
│                      │    │                          │
│ violation_code       │    │ violation_code           │
│ law_code             │    │ original_description     │
│ description_keyword  │    │ corrected_description    │
│ category             │    │ applied (bool)           │
│                      │    │                          │
│ Regra: JOIN usa      │    │ Correções aplicadas      │
│ description_keyword  │    │ in-place em              │
│ IS NULL (categoria   │    │ traffic_violations.      │
│ padrão do código)    │    │ description              │
└──────────────────────┘    └──────────────────────────┘
```

### 3.2 Detalhes das Tabelas

#### `traffic_violations` — Tabela principal (~2.2M registros)

| Coluna | Tipo | Null | Descrição |
|--------|------|------|-----------|
| `id` | serial PK | NOT NULL | |
| `violation_date` | timestamptz | NOT NULL | Data/hora da infração |
| `agent_id` | integer | NOT NULL | 0-9 (ver AGENT_INFO) |
| `violation_type_id` | integer | NOT NULL | ID do tipo de infração |
| `location_id` | integer | NOT NULL | FK lógico → `traffic_locations.location_id` |
| `violation_code` | text | NOT NULL | Código CTTU (ex: "5452", "7455") |
| `law_code` | text | NOT NULL | Artigo do CTB (ex: "Art. 181 Inc. VIII") |
| `description` | text | NOT NULL | Descrição da infração |
| `location_description` | text | NOT NULL | Texto bruto do local |
| `coordinates` | text | nullable | Coordenadas |
| `street_code` | integer | nullable | FK → `street_codes.code` (preenchido pelo match-pipeline) |
| `complementary_data` | jsonb | nullable | Dados extras |
| `created_at` / `updated_at` | timestamptz | NOT NULL | |

**Índices**: PK em `id`. FK em `street_code`.

#### `violation_categories` — Classificação CTB

| Coluna | Tipo | Null | Descrição |
|--------|------|------|-----------|
| `id` | serial PK | NOT NULL | |
| `violation_code` | text | NOT NULL | INDEX |
| `law_code` | text | NOT NULL | |
| `description_keyword` | text | nullable | NULL = categoria padrão; preenchido = override por keyword |
| `category` | text | NOT NULL | INDEX. Ex: "Pedestres", "Ciclistas", "Segurança viária" |

**Regra de uso**: O JOIN nos endpoints usa `description_keyword IS NULL` para pegar a categoria **padrão** de cada código.

#### `location_street_matches` — Resultado do matching

| Coluna | Tipo | Null | Descrição |
|--------|------|------|-----------|
| `location_id` | integer UNIQUE | NOT NULL | |
| `matched_street_code` | integer FK | nullable | → `street_codes.code` |
| `match_method` | text | nullable | `exact_code`, `exact_normalized`, `levenshtein`, `trigram` |
| `match_confidence` | numeric | nullable | 0–1 |
| `needs_validation` | boolean | false | Precisa de validação manual |
| `validation_status` | text | nullable | `pending`, `confirmed`, `rejected` |
| `alternative_candidates` | jsonb | nullable | Top 5 matches alternativos |
| `normalized_data` | jsonb | nullable | Dados normalizados usados no match |

#### `traffic_locations` — Dicionário de locais (~85K+ entradas)

Substitui o `dict_locais_v2.json` (38MB). Uma linha por local único.

#### `traffic_equipment` — Equipamentos de fiscalização

Radares, lombadas eletrônicas, fotosensores com referência a `street_codes`.

#### `description_corrections` — Correções de descrição

Pares (original, corrigido). `applied = false` indica pendente de aplicação.

---

## 4. Fluxo de Dados (Raw → Banco)

```
ETAPA 0: MIGRATIONS (uma vez)
────────────────────────────────
  pnpm db:migrate
    ├── 0000_add_traffic_locations_equipment.sql
    │     Cria: traffic_locations, traffic_equipment
    │     Altera: location_street_matches (+colunas is_new, created_by)
    └── 0001_seed_traffic_locations.sql (gerado pelo ETL, 6.7MB)
          Popula: traffic_locations (~85K+ entradas)

ETAPA 1: CARGA DE RUAS PCR (dados geoespaciais)
────────────────────────────────────────────────
  logradouros-bairro.tsv ──► street_codes
    (11.922 logradouros com código, nome oficial, nome resumido, bairro)

    NOTA: A tabela street_codes substituiu a antiga official_streets
          (migration 0013_drop_official_streets.sql no pacote @atlas/database)

ETAPA 2: ETL PYTHON (normalização de infrações)
─────────────────────────────────────────────────
  all-infracoes/*.tsv (1.2 GB, 15 arquivos)
    +
  dict_agentes_v2.json (12 agentes)
  dict_infracoes_v2.json (876 infrações)
  dict_locais_v2.json (~568K locais)
    │
    ▼
  etl-normalize.py --apply
    │
    ├──► infracoes_reduzido_v2.tsv (~2.2M linhas normalizadas)
    │      → (bulk COPY) → traffic_violations
    │
    ├──► dict_locais_v3.json (dicionário expandido)
    │
    └──► 0001_seed_traffic_locations.sql
           → traffic_locations

ETAPA 3: SEED DE CATEGORIAS (classificação CTB)
─────────────────────────────────────────────────
  tsx src/db/seed-all.ts
    │
    ├── Step 1: seed-violation-categories.ts
    │     Entrada: tabela_infracoes_ctb_classificada_*.csv (243 artigos)
    │     Lê: traffic_violations (violation_code, law_code)
    │     Escreve: violation_categories (DELETE + INSERT)
    │     Resultado: cada código → {Pedestres, Ciclistas, Segurança viária, ...}
    │
    └── Step 2: seed-description-corrections.ts
          Entrada: descricoes_infracoes_corrigidas.csv (554 correções)
          Fase 1: Insere em description_corrections
          Fase 2: Atualiza traffic_violations.description in-place

ETAPA 4: MATCHING DE RUAS (enriquecimento geoespacial)
────────────────────────────────────────────────────────
  pnpm db:match --apply
    │
    ├── Fase 1: Match exato via código CSV
    │     Entrada: enderecos_otimizado.csv (código do logradouro)
    │     → location_street_matches (match_method: exact_code)
    │
    ├── Fase 2: Match textual para órfãos
    │     Dicionário de variantes: dict_variantes_ruas.json (194 regras)
    │     Algoritmos: exact_normalized → levenshtein → trigram
    │     → location_street_matches (match_method: exact_normalized/levenshtein/trigram)
    │
    └── Fase 3: Aplica matches
          Atualiza traffic_violations.street_code
          (WHERE street_code IS NULL)
```

---

## 5. Sistema de Equivalência de Ruas (Matching)

### 5.1 Situação Atual — CRÍTICO

O sistema de equivalência de nomes de rua funciona em **3 camadas**, NENHUMA delas é uma tabela de banco de dados editável:

| Camada | Onde vive | Formato | Editável? |
|--------|-----------|---------|-----------|
| **Dicionário de variantes** | `dict_variantes_ruas.json` (arquivo) | 194 regras pattern→replacement+code | Sim, editando o JSON |
| **Normalizador** | `street-normalizer.ts` (código) | Abreviações (AV→AVENIDA, DR→DOUTOR, etc.) | Não |
| **Algoritmos de matching** | `street-matcher.ts` (código) | exact, levenshtein, trigram | Não |

**Problema**: O dicionário de variantes (`dict_variantes_ruas.json`) é a única camada editável, mas:
- **Não é uma tabela de banco**. É um JSON carregado em memória.
- **Mudanças não são refletidas automaticamente**. Para corrigir um match errado, é preciso:
  1. Editar o JSON
  2. Re-rodar `pnpm db:match --apply`
  3. O pipeline reprocessa TODOS os locations órfãos
- **Não tem API de gestão**. Não dá pra adicionar/editar/remover variantes via endpoint.
- **Não é usado nos endpoints de busca**. Os endpoints de ruas não aplicam o dicionário de variantes em queries — só o pipeline batch usa.

O fluxo atual do dicionário de variantes:

```
dict_variantes_ruas.json
  │
  ▼
match-pipeline.ts (carrega em memória)
  │
  ▼
applyVariantDictionary(streetName, dict)
  │
  ▼
matchExactName(transformedName, streets)
  │
  ▼
location_street_matches (resultado final)
  │
  ▼
traffic_violations.street_code (aplicado em registros órfãos)
```

### 5.2 API de Matching (existente)

| Método | Path | Função |
|--------|------|--------|
| POST | `/v1/streets/match` | Match individual (usa orchestrator com streets carregadas do banco) |
| POST | `/v1/streets/match/batch` | Match em lote |
| GET | `/v1/streets/match/stats` | Estatísticas de matching |

### 5.3 API de Validação (existente)

| Método | Path | Função |
|--------|------|--------|
| GET | `/v1/streets/validations/pending` | Lista matches que precisam validação |
| POST | `/v1/streets/validations/{id}/confirm` | Confirma match |
| POST | `/v1/streets/validations/{id}/reject` | Rejeita match |
| GET | `/v1/streets/validations/page` | Página HTML de validação |

---

## 6. Classificação de Infrações (Categories)

### 6.1 Categorias

As infrações são classificadas em 6 categorias editoriais:

| Categoria | Exemplos de códigos |
|-----------|-------------------|
| **Segurança viária** | 7455 (avanço de sinal), 6050 (excesso de velocidade), 7633 (celular) |
| **Estacionamento/uso da via** | 5452 (estacionar em local proibido), 5622 (parar sobre faixa) |
| **Administrativas/documentais** | 6416 (documento vencido), 6920 (sem licenciamento) |
| **Pedestres** | Subclassificação de 5452 (passeio), 5819 (calçadas) |
| **Ciclistas** | Subclassificação de 5452 (ciclovia), 5819 (ciclofaixas) |
| **Transporte coletivo** | Infrações específicas de ônibus/transporte |

### 6.2 Como funciona a classificação

```
violation_categories
├── violation_code = "5452", description_keyword = NULL      → "Estacionamento/uso da via" (padrão)
├── violation_code = "5452", description_keyword = "passeio"  → "Pedestres"               (override)
├── violation_code = "5452", description_keyword = "ciclovia" → "Ciclistas"               (override)
└── violation_code = "5452", description_keyword = "gramados" → "Estacionamento/uso da via" (override)
```

**Regra**: O JOIN nos endpoints usa `description_keyword IS NULL` para pegar a categoria **padrão**. As linhas com keyword são usadas apenas pelo `generate-dictionary-csv.ts` para pré-classificação fina.

### 6.3 Origem dos dados

1. `tabela_infracoes_ctb_classificada_pedestres_ciclistas_separados.csv` — 243 artigos do CTB com classificação manual
2. `seed-violation-categories.ts` — cruza o CSV com `traffic_violations`, normaliza `law_code`, aplica mapeamentos manuais para 13 códigos que não batem
3. Keywords de subclassificação (11 regras para código 5452, 5819, etc.) permitem classificação fina baseada na descrição

### 6.4 Pendências na API (categoria)

3 endpoints NÃO incluem a coluna `category` no retorno:

| Endpoint | Campo sem category |
|----------|--------------------|
| `GET /dashboard/top-violations` | `violations[].category` |
| `GET /dashboard/top-streets` | `streets[].top_violation.category` |
| `GET /dashboard/agent-analysis` | `agents[].top_violations[].category` |

Os demais endpoints de dashboard já incluem (`violation-codes` e `categories`).

---

## 7. API Endpoints × Tabelas

### Dashboard

| Método | Path | Tabelas | Status |
|--------|------|---------|--------|
| GET | `/v1/dashboard/overview` | TV + OS | ✅ |
| GET | `/v1/dashboard/top-violations` | TV | 🔴 sem `category` |
| GET | `/v1/dashboard/top-streets` | TV + OS + PCR | 🔴 `top_violation.category` |
| GET | `/v1/dashboard/temporal` | TV | ✅ (com `by_year`) |
| GET | `/v1/dashboard/agent-analysis` | TV | 🔴 `top_violations[].category` |
| GET | `/v1/dashboard/violation-codes` | TV + VC | ✅ |
| GET | `/v1/dashboard/categories` | VC | ✅ |

### Streets

| Método | Path | Tabelas | Status |
|--------|------|---------|--------|
| GET | `/v1/streets` | OS | ✅ |
| GET | `/v1/streets/{code}` | OS | ✅ |
| GET | `/v1/streets/ranking` | TV + OS + PCR | ✅ |
| GET | `/v1/streets/{code}/summary` | TV + OS | ✅ |
| GET | `/v1/streets/{code}/violations` | TV | ✅ |
| GET | `/v1/streets/neighborhoods` | TV + OS | ⚠️ hardcoded vazio |
| GET | `/v1/streets/geojson` | TV + OS + PCR | ✅ |

### Matching

| Método | Path | Tabelas | Status |
|--------|------|---------|--------|
| POST | `/v1/streets/match` | LSM | ✅ |
| POST | `/v1/streets/match/batch` | LSM | ✅ |
| GET | `/v1/streets/match/stats` | LSM | ✅ |

### Validation

| Método | Path | Tabelas | Status |
|--------|------|---------|--------|
| GET | `/v1/streets/validations/pending` | LSM | ✅ |
| POST | `/v1/streets/validations/{id}/confirm` | LSM | ✅ |
| POST | `/v1/streets/validations/{id}/reject` | LSM | ✅ |
| GET | `/v1/streets/validations/page` | — | ✅ (HTML) |

### Violations

| Método | Path | Tabelas | Status |
|--------|------|---------|--------|
| GET | `/v1/violations` | TV | ✅ (month+year obrigatórios) |
| GET | `/v1/violations/{id}` | TV | ✅ |
| GET | `/v1/violations/by-location` | TV | ✅ |

### Summary

| Método | Path | Tabelas | Status |
|--------|------|---------|--------|
| GET | `/v1/violations/summary` | TV | ✅ |
| GET | `/v1/violations/summary/by-type` | TV | ✅ |
| GET | `/v1/violations/summary/by-agent` | TV | ✅ |
| GET | `/v1/violations/summary/temporal` | TV | ✅ |

**Legenda**: TV = `traffic_violations`, OS = `street_codes` (official streets), PCR = `pcr_streets`, VC = `violation_categories`, LSM = `location_street_matches`

---

## 8. Pendências e Problemas Conhecidos

### 8.1 Problemas Estruturais

| # | Problema | Severidade | Solução |
|---|----------|-----------|---------|
| 1 | **Dicionário de variantes é JSON, não tabela** | **CRÍTICO** | Criar tabela `street_name_variants` no banco, com CRUD via API, e usar nos endpoints + pipeline |
| 2 | **`infracoes_reduzido.tsv` (88MB) e `enderecos_otimizado.csv` (43MB) commitados** | Média | `git rm --cached` |
| 3 | **`openapi.json` (114KB) commitado** | Baixa | `git rm --cached` (já é gerado) |
| 4 | **`dict_locais_v2.json` tem 38MB** | Média | Idealmente seria substituído pela tabela `traffic_locations` no banco. O ETL ainda depende dele |
| 5 | **`seed.ts` é dummy, nunca usado** | Baixa | Remover ou manter como exemplo |
| 6 | **`/streets/neighborhoods` retorna array vazio** | Baixa | Implementar usando `logradouros-bairro.tsv` |

### 8.2 Pendências Funcionais

| # | Pendência | Impacto |
|---|-----------|---------|
| 1 | Adicionar `category` em `top-violations`, `top-streets`, `agent-analysis` | Frontend não mostra categoria nesses cards |
| 2 | Novos dados em `all-infracoes/` ainda não passaram pelo seed | ~1.2GB de dados brutos esperando ETL |
| 3 | `location_street_matches` com `needs_validation = true` precisam ser revisados | Matches incorretos podem distorcer análises por rua |
| 4 | `traffic_equipment` está vazio — CSVs existem mas não foram importados | Equipamentos não disponíveis na API |

### 8.3 Dados Novos Não Processados

O diretório `all-infracoes/` contém **15 arquivos TSV** (~1.2 GB total), enquanto o ETL atualmente processa apenas 5 deles (2021-2025). Os outros 10 arquivos são fontes adicionais de infrações que precisam ser incorporadas ao pipeline.

---

## 9. Recomendações

### 9.1 Imediatas (corrigir sem mudar estrutura)

1. **Completar JOINs de `category`** nos 3 endpoints pendentes do dashboard
2. **Corrigir testes quebrando** (5 falhas por status 422 não esperado)
3. **`git rm --cached`** nos 3 arquivos grandes commitados indevidamente
4. **Rodar ETL nos dados novos** de `all-infracoes/` para expandir a base

### 9.2 Estruturais (mudar arquitetura)

1. **Criar tabela `street_name_variants`** no banco:
   ```sql
   CREATE TABLE street_name_variants (
     id SERIAL PRIMARY KEY,
     pattern TEXT NOT NULL,
     replacement TEXT NOT NULL,
     target_street_code INTEGER REFERENCES street_codes(code),
     note TEXT,
     is_active BOOLEAN DEFAULT true,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```
   - Migrar as 194 regras do `dict_variantes_ruas.json` para a tabela
   - Adicionar endpoints CRUD em `/v1/streets/variants`
   - Refatorar `match-pipeline.ts` para ler da tabela em vez do JSON
   - Usar a tabela também nos endpoints de busca de rua

2. **Substituir `dict_locais_v2.json` (38MB)** pela tabela `traffic_locations` que já existe. O ETL deve usar o banco como fonte, não o JSON.

3. **Seed de equipamentos**: Importar `equipamentos-*.csv` para `traffic_equipment`.

4. **Pipeline de matching reutilizável**: Separar a lógica de matching em um serviço que possa ser chamado tanto pelo pipeline batch quanto pela API em tempo real, usando o banco como fonte de verdade para as regras de variantes.

### 9.3 Limpeza

| Ação | Arquivo(s) |
|------|-----------|
| Remover do git | `infracoes_reduzido.tsv`, `enderecos_otimizado.csv`, `openapi.json` |
| Remover do projeto | `src/db/seed.ts` (dummy) |
| Manter como referência | `export-descriptions-csv.ts`, `generate-dictionary-csv.ts`, `random-queries.sql` |
| Migrar para tabela | `dict_variantes_ruas.json` (→ `street_name_variants`), `dict_locais_v2.json` (→ `traffic_locations`) |

---

## Apêndice: AGENT_INFO

| agent_id | Descrição | Categoria |
|----------|-----------|-----------|
| 0 | NA | manual |
| 1 | Convênio BPTRAN | manual |
| 2 | Zona Azul - Talão Manual | manual |
| 3 | Lombada Eletrônica | eletronico |
| 4 | Radar | eletronico |
| 5 | Fotosensor | eletronico |
| 6 | Autos no Talão Manual | manual |
| 7 | Zona Azul - Talão Eletrônico | manual |
| 8 | Autos no Talão Eletrônico | manual |
| 9 | Faixa Azul | eletronico |
