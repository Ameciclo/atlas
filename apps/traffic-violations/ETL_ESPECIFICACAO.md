# ETL — Especificação para Normalização

> 2026-05-31. 19 arquivos, 8.47M linhas, 2007–2025.

---

## 1. Arquivos de Entrada

```
all-infracoes/
  2007.tsv  (157K)  2011.tsv  (229K)  2015.tsv  (629K)  2019.tsv  (869K)  2023.tsv  (489K)
  2008.tsv  (161K)  2012.tsv  (247K)  2016.tsv  (597K)  2020.tsv  (706K)  2024.tsv  (405K)
  2009.tsv  (201K)  2013.tsv  (332K)  2017.tsv  (612K)  2021.tsv  (599K)  2025.tsv  (171K)
  2010.tsv  (230K)  2014.tsv  (418K)  2018.tsv  (828K)  2022.tsv  (597K)
```

Dois formatos de arquivo:

### Formato A: Datastore TSV (2007–2012, 2025)
- Separador: `\t` (tab)
- Header: `_id	datainfracao	horainfracao	dataimplantacao	agenteequipamento	infracao	descricaoinfracao	amparolegal	localcometimento`
- Encoding: UTF-8 com BOM
- 6 arquivos

### Formato B: CSV direto (2013–2024)
- Separador: `;` (ponto-e-vírgula), campos com aspas duplas
- Header: `"datainfracao";"horainfracao";"dataimplantacao";"agenteequipamento";"infracao";"descricaoinfracao";"amparolegal";"localcometimento"`
- Encoding: UTF-8
- 13 arquivos

### Colunas trocadas
**2022** tem as últimas duas colunas invertidas: `localcometimento` antes de `amparolegal`. Detectar verificando se a coluna 7 (0-index: 6) começa com `Art.` — se sim, é `amparolegal` e a coluna 8 é `localcometimento`. Se não, estão trocadas.

---

## 2. Data e Hora → `violation_date`

### Formatos por ano

| Ano(s) | Formato data | Formato hora | Exemplo |
|--------|-------------|-------------|---------|
| 2007–2012, 2025 (TSV) | `YYYY-MM-DD` (col 2) | `HH:MM:SS` (col 3) | `2010-02-18` `09:08:00` |
| 2013–2014, 2016–2023 (CSV) | `YYYY-MM-DD` (col 1) | `HH:MM:SS` (col 2) | `2013-01-03` `10:45:00` |
| 2015 (CSV) | `YYYY/MM/DD HH:MM:SS.mmm` (col 1) | embutida na data | `2015/10/26 08:42:00.000` |
| 2024 (CSV) | `DD/MM/YYYY HH:MM` (col 1) | embutida na data | `01/01/2024 00:59` |

### Lógica de parsing

```python
from datetime import datetime

def parse_date(raw):
    """Tenta 3 formatos em sequência."""
    for fmt in ['%Y-%m-%d', '%d/%m/%Y', '%Y/%m/%d']:
        try:
            return datetime.strptime(raw[:10], fmt).strftime('%Y-%m-%d')
        except: pass
    return None

def parse_time(raw):
    """Extrai HH:MM:SS de texto de hora."""
    m = re.match(r'(\d{1,2}):(\d{2})(?::(\d{2}))?', raw)
    if m:
        return f"{int(m.group(1)):02d}:{m.group(2)}:{m.group(3) or '00'}"
    return None
```

### Regra de descarte
Linhas com **data vazia** ou **data não parseável** → descartar (3 ocorrências em 2019-2020).

---

## 3. Agente → `agent_id`

### Mapeamento

O campo `agenteequipamento` contém o número do agente embutido no texto. Extrair o primeiro dígito 1–9:

```python
def extract_agent_id(raw):
    nums = re.findall(r'\d+', raw)
    for n in nums:
        ni = int(n)
        if 1 <= ni <= 9:
            return ni
    return 0  # NA
```

### Tabela de equivalência

| agent_id | Nome limpo | Categoria |
|----------|-----------|-----------|
| 0 | NA | manual |
| 1 | Convênio BPTRAN | manual |
| 2 | Zona Azul — Talão Manual | manual |
| 3 | Lombada Eletrônica | eletronico |
| 4 | Radar | eletronico |
| 5 | Fotosensor | eletronico |
| 6 | Autos no Talão Manual | manual |
| 7 | Zona Azul — Talão Eletrônico | manual |
| 8 | Autos no Talão Eletrônico | manual |
| 9 | Faixa Azul | eletronico |

Essa tabela **já existe no código** em `src/lib/query-helpers.ts` como `AGENT_INFO`. O `dict_agentes_v2.json` atual usa os nomes brutos com "Código X — ..." e pode ser simplificado.

### Casos marginais (0.001%)
- `""` (vazio): 62K linhas em 2025 → agent_id = 0 (NA)
- `"Agente/Equipamento"` (header vazado): 3 linhas → agent_id = 0, descartar
- `"225310"` (linha corrompida): 1 linha → descartar
- `"Cdigo 8...\t6033"` (linha corrompida): 1 linha → descartar

---

## 4. Infração, Amparo Legal e Descrição → `traffic_violations_catalog`

### Colunas nos arquivos

| Campo | TSV (col) | CSV (col) | Destino no banco |
|-------|-----------|-----------|-----------------|
| `infracao` | 6 | 5 | `cttu_code` |
| `amparolegal` | 8 (ou 7 se trocado) | 7 (ou 8 se trocado) | `law_code` |
| `descricaoinfracao` | 7 | 6 | `description` |

### Relação `cttu_code` ↔ `law_code`

Após normalização (remover `do CTB`, corrigir `alnea`→`alínea`, unificar `§único`/`nico`), a relação é **essencialmente 1:1**:

| Métrica | Valor |
|---------|-------|
| Códigos de infração únicos | 247 |
| Leis canônicas únicas | ~265 |
| Códigos 1:1 com lei | 206 (83%) |
| Códigos com N leis (variantes de encoding) | 41 → 0 após normalização |
| Leis com N códigos (real, mesmo artigo) | 3: Art. 174, Art. 231 X, Art. 246 |

### Estatísticas das descrições (8.47M linhas)

```
Descrições brutas (code+law+desc):       1,868 combinações
Após correção de encoding (679 pares):     774 variantes
Após auto-dedup + truncamento:             500 descrições canônicas
Leis com >1 descrição (especificidade):    100 artigos
```

### Catálogo de Infrações

Arquivo: `src/db/traffic_violations_catalog_classified.csv`

Tabela de referência com 500 linhas. Colunas:

| Coluna | Descrição |
|--------|-----------|
| `law_code` | Amparo legal canônico (ex: `Art. 193`) |
| `canonical_description` | Descrição normalizada (com acentos, sem truncamento) |
| `category` | Classificação CTB |
| `total_rows` | Frequência nos dados brutos |

**Categorias** (489/500 classificadas):

| Categoria | Linhas |
|-----------|--------|
| Segurança viária | 263 |
| Administrativas/documentais | 83 |
| Pedestres | 56 |
| Fluidez do trânsito | 32 |
| Estacionamento/uso da via | 29 |
| Ciclistas | 11 |
| Outras/não classificadas | 11 |
| Transporte coletivo | 4 |

As 11 não classificadas são edge cases: decreto municipal (`Art. 45, Dec. 96.044/88`), garbage (`Art. 218, Inc. Inc`), cross-reference incompleta.

### Preservação de especificidade

100 artigos do CTB têm **múltiplas descrições canônicas**, capturando sub-tipos que o `law_code` sozinho não distingue:

**Exemplo — Art. 193** (9 descrições, mesma lei, situações diferentes):
```
Transitar com veículo em calçadas e passeios.       → Pedestres
Transitar com veículo em ciclovias ou ciclofaixas.  → Ciclistas
Transitar com veículo em acostamentos.              → Segurança viária
Transitar com veículo em passarelas.                → Pedestres
...
```

**Exemplo — Art. 189** (8 descrições, mesmo artigo, veículos diferentes):
```
Deixar de dar passagem aos veículos de polícia...   → Segurança viária
Deixar de dar passagem às ambulâncias...            → Segurança viária
Deixar de dar passagem aos veículos de incêndio...  → Segurança viária
...
```

### Pipeline de construção do catálogo

```
1. build-infraction-catalog.py
   ├── Extrai todos os pares (law, desc) dos 19 arquivos
   ├── Aplica 414 correções manuais existentes
   ├── Auto-detecta +266 correções de encoding (similaridade trigram >72%)
   ├── Detecta 5 truncamentos (descrição é prefixo de outra mais longa)
   └── Output: traffic_violations_catalog.csv (500 linhas, category vazia)

2. classify-catalog.py
   ├── Cruza law_code com tabela CTB (243 artigos classificados)
   ├── Aplica 13 mapeamentos manuais (códigos não batidos)
   ├── Aplica 28 regras de keyword (sub-classificação por descrição)
   └── Output: traffic_violations_catalog_classified.csv (500 linhas, 489 classificadas)
```

### Uso no ETL

O ETL usa o catálogo como **dimensão de classificação**. Para cada linha bruta:

1. Extrai `cttu_code`, `law_code`, `description`
2. Limpa: remove `,0` do código, descarta se `law_code` não começa com `Art.`
3. Corrige encoding da `description` via `descricoes_infracoes_corrigidas_expanded.csv`
4. Faz lookup no catálogo por `(law_code, canonical_description)` → obtém `category`
5. Se não houver match exato, tenta o `law_code` sozinho (categoria padrão do artigo)

---

## 5. Local → `location_id` + `location_description` + enrichment

### Coluna

| Campo | TSV (col) | CSV (col) | Destino |
|-------|-----------|-----------|---------|
| `localcometimento` | 9 (ou 8 se trocado) | 8 (ou 7 se trocado) | `location_description` |

### Estatísticas (8.47M linhas, 1.117.471 strings únicas)

```
Strings de local únicas:          1.117.471
Singletons (aparecem 1x só):        749.600 (67%)
Dict atual (dict_locais_v2.json):   568.254 entries
Novos locais vs dict v2:            737.816 (66%)
```

### Estrutura do texto de local

Cada string contém: `[RUA/AV] [NOME] [REFERÊNCIA] [SENTIDO] [FAIXA]`. Exemplo:

```
"AV GOV AGAMENON MAGALHAES NO SEMAF NR 068 SENTIDO OLINDA/B VIAGEM PISTA LESTE"
```

| Componente | Exemplo | Frequência |
|-----------|---------|-----------|
| Prefixo de rua (RUA, AV, etc.) | `AV` | 99% |
| Sentido/direção | `SENTIDO OLINDA/BOA VIAGEM` | 83% |
| Número de referência (NR, Nº) | `NR 068` | 39% |
| Semáforo | `SEMAFORO 486` | 14% |
| Poste | `POSTE NR B000404` | 2% |
| Cruzamento (CRUZAMENTO, COM, X) | `CRUZAMENTO ARTUR MUNIZ` | ~5% |
| Faixa | `Faixa: 2` | presente em eletrônicas |

### Abordagem em 3 camadas

#### Camada 1 — Equipamentos: ponto exato (31,4% dos dados)
Resolução via tabelas de equipamentos com lat/lon conhecido.

**Semáforos** (`localizacao_semaforos.tsv`, 712 entradas):

| Métrica | Valor |
|---------|-------|
| Strings com semáforo | 160.214 |
| Semáforos na tabela | 712 |
| Strings resolvidas (número → endereço + lat/lon) | 158.946 |
| Linhas cobertas | 2.584.759 (30,5%) |

**Postes** (`localizacao_postes.tsv`, 76.502 entradas):

| Métrica | Valor |
|---------|-------|
| Strings com poste | 39.266 |
| Códigos na tabela | 5.539 |
| Strings resolvidas (código → endereço + lat/lon) | 23.305 |
| Linhas cobertas | 73.108 (0,9%) |

**Confiança**: `high` — coordenada exata via tabela oficial.

#### Camada 2 — Extração de nome de rua (68,6% dos dados)
Para locais sem equipamento ou com equipamento não encontrado na tabela.

**Extração** (`build-location-dict.py`):

| Métrica | Valor |
|---------|-------|
| Strings com nome de rua extraído | 1.117.423 (99,99%) |
| Strings sem nome de rua (apenas referência) | 43 (0,004%) |

**Matching** (post-ETL, via `match-pipeline.ts`):
- Extrai nome de rua → normaliza → match contra `logradouros-bairro.tsv` (11.922 ruas oficiais)
- Algoritmos: exato → variantes (`dict_variantes_ruas.json`) → levenshtein → trigram
- Cruzamentos: detecta `CRUZAMENTO`, `COM`, `X` → extrai ambas as ruas
- Desambiguação: preferir match mais longo; usar bairro se disponível

**Confiança**: `medium` (nome extraído, match pendente) → `high` (após match bem-sucedido).

#### Camada 3 — Dicionário bruto (fallback, < 0,01%)
Para os 43 locais sem nome de rua extraível:
- Atribuir `location_id` sequencial
- Preservar texto bruto para inverse geocoding futuro
- Marcados `needs_review = true`

**Confiança**: `low`.

### Preservação para inverse geocoding

Todo local preserva o texto bruto (`location_description`) integral, mesmo quando resolvido por equipamento. Isso permite que um inverse geocoder futuro refine a localização a partir do texto original.

Campos extraídos e armazenados no dicionário enriquecido:

| Campo | Descrição |
|-------|-----------|
| `raw` | Texto bruto original (para inverse geocoding) |
| `equipment_type` | `semaphore` ou `post` |
| `equipment_number` | Número/código do equipamento |
| `equipment_address` | Endereço canônico do equipamento (via tabela) |
| `equipment_neighborhood` | Bairro (via tabela) |
| `latitude` / `longitude` | Coordenadas (via tabela de equipamento) |
| `street_type` | Tipo: RUA, AVENIDA, PRACA, etc. |
| `street_name` | Nome extraído |
| `cross_street` | Rua transversal (se cruzamento) |
| `direction` | Sentido: SENTIDO CENTRO, SENTIDO SUB/CID, etc. |
| `address_number` | Número: NR 675, Nº 914 |
| `confidence` | `high` / `medium` / `low` |
| `needs_review` | `true` se precisa revisão humana |

### Pipeline de construção do dicionário

```
build-location-dict.py --apply
├── Extrai 1.117.471 strings únicas dos 19 arquivos
├── Para cada string:
│   ├── Extrai direção (83% dos locais)
│   ├── Extrai equipamento (semáforo/post) → lookup nas tabelas
│   │   ├── Match → lat/lon + endereço + bairro (confidence: high)
│   │   └── Sem match → equipamento não encontrado na tabela
│   ├── Extrai nome de rua (99.99% dos locais)
│   ├── Extrai rua transversal (cruzamentos)
│   └── Extrai número de endereço
├── Output: dict_locais_v3.json (664 MB, 1.1M entries)
├── Output: traffic_locations_v3.tsv (142 MB)
└── Output: 0001_seed_traffic_locations.sql (161 MB)
```

### Uso no ETL

O ETL faz lookup simples: `string bruta → location_id` via `dict_locais_v3.json`.
A saída TSV do ETL inclui `location_id` e `location_description` (texto bruto).

O enriquecimento (street_code, lat/lon, bairro) é aplicado **depois** do ETL:

```
1. ETL: string bruta → location_id
2. COPY: infracoes_reduzido_v3.tsv → traffic_violations
3. SQL: traffic_locations_v3.tsv → traffic_locations (enrichment table)
4. match-pipeline.ts: street_name → street_code (matching geoespacial)
```

---

## 6. Saída do ETL

Arquivo canônico: `infracoes_reduzido_v3.tsv`

Colunas (TSV, tab-separated, UTF-8):
```
violation_date  agent_id  cttu_code  law_code  description  location_id  location_description

- `violation_date`: `YYYY-MM-DD HH:MM:SS` (timestamp)
- `agent_id`: inteiro 0–9 (da tabela de equivalência)
- `cttu_code`: string numérica, sem `,0`
- `law_code`: texto limpo do amparo legal
- `description`: melhor versão disponível (com acentos, sem truncamento)
- `location_id`: inteiro sequencial único
- `location_description`: texto bruto do local

---

## 7. Ordem de Execução

```
PRÉ-REQUISITOS (rodar uma vez, geram artefatos de referência):
0a. build-infraction-catalog.py --apply   → traffic_violations_catalog.csv + correções de encoding
0b. classify-catalog.py --apply            → traffic_violations_catalog_classified.csv
0c. build-location-dict.py --apply         → dict_locais_v3.json + traffic_locations SQL

EXECUÇÃO PRINCIPAL:
1. ETL Python          → infracoes_reduzido_v3.tsv + dict_locais_v3.json
2. Bulk COPY           → traffic_violations (PostgreSQL)
3. SQL Seed            → traffic_locations (via 0001_seed_traffic_locations.sql)
4. seed-catalog.ts     → popula traffic_violations_catalog + aplica category nas violations
5. match-pipeline.ts   → popula location_street_matches + street_code (matching geoespacial)
```
