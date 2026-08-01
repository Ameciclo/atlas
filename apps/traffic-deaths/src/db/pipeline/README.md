# Pipeline de Mortes de Trânsito (DATASUS)

Converte arquivos DBC do DATASUS SIM em CSVs filtrados para o seed do banco.

## Requisitos

```bash
pip install --break-system-packages pyreaddbc dbfread
wget  # (já vem no Ubuntu)
```

## Uso rápido

```bash
# Baixar do DATASUS e converter 2024
python3 convert-dbc.py --download 2024

# Múltiplos anos
python3 convert-dbc.py --download 2024,2025

# Com sequelas Y85/Y86 + colunas reduzidas + limpar DBCs após
python3 convert-dbc.py --download 2024 --include-y --strip-columns --rm
```

## Uso com DBCs locais

```bash
python3 convert-dbc.py --source-dir /caminho/com/dbcs/
```

## Fluxo

```
DATASUS FTP                           pipeline/datasus-dbc/         seed-data/
DOEXT24.dbc ──wget──> DOEXT24.dbc ──dbc→csv──> mortes_transito_2024.csv
                                            filtro: CAUSABAS LIKE 'V%'
```

## Flags

| Flag | Descrição |
|------|-----------|
| `--download AAAA` | Baixa do FTP do DATASUS (ex: `2024` ou `2024,2025`) |
| `--source-dir DIR` | Usa DBCs de um diretório local |
| `--include-y` | Inclui sequelas Y85/Y86 além de V% |
| `--strip-columns` | Remove ~37 colunas não usadas pelo seed |
| `--rm` | Apaga os .dbc após conversão |
| `--dry-run` | Preview, não baixa nem grava |
| `--output-dir DIR` | Diretório de saída (default: `packages/database/seed-data/traffic-deaths/`) |

## Output

O CSV gerado tem o formato padrão SIM (87 colunas, RFC 4180) e é compatível direto com o seed.

Para efetivar no banco após gerar o CSV:

```bash
# Adicionar o ano no array `years` dos scripts:
#   packages/database/src/seed-traffic-deaths.ts
#   apps/traffic-deaths/src/db/seed.ts

# Rodar o seed
pnpm db:seed
```
