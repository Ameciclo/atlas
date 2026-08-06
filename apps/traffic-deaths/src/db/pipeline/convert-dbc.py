#!/usr/bin/env python3
"""
Pipeline de conversao DATASUS: DBC -> CSV filtrado para mortes de transito.

Uso:
  # Download direto do DATASUS + conversao
  python3 convert-dbc.py --download 2024,2025
  python3 convert-dbc.py --download 2024 --include-y --strip-columns --rm

  # A partir de DBCs locais
  python3 convert-dbc.py --source-dir /caminho/dos/dbc/ --year 2024

DATASUS FTP: tenta CID10, com fallback para PRELIM (dados preliminares)

Fluxo:
  1. (--download) Baixa DBCs do DATASUS FTP para source-dir
  2. Le arquivos .dbc da pasta de origem
  3. Converte para CSV (formato SIM padrao, 87 colunas)
  4. Filtra apenas registros com CAUSABAS iniciando com V (ou Y, se --include-y)
  5. Opcionalmente remove colunas nao usadas pelo seed (--strip-columns)
  6. Salva como mortes_transito_{ano}.csv em packages/database/seed-data/traffic-deaths/
  7. Opcionalmente apaga os DBC originais (--rm)
"""

import argparse
import csv
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from pyreaddbc import readdbc
except ImportError:
    print("ERRO: biblioteca 'pyreaddbc' nao encontrada.", file=sys.stderr)
    print("Instale com: pip install --break-system-packages pyreaddbc", file=sys.stderr)
    sys.exit(1)

try:
    from dbfread import DBF
except ImportError:
    print("ERRO: biblioteca 'dbfread' nao encontrada.", file=sys.stderr)
    print("Instale com: pip install --break-system-packages dbfread", file=sys.stderr)
    sys.exit(1)


SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent.parent.parent.parent.parent
DEFAULT_OUTPUT_DIR = PROJECT_ROOT / "packages" / "database" / "seed-data" / "traffic-deaths"
DEFAULT_SOURCE_DIR = SCRIPT_DIR / "datasus-dbc"

DATASUS_FTPS = [
    "ftp://ftp.datasus.gov.br/dissemin/publicos/SIM/CID10/DOFET/DOEXT{yy}.dbc",
    "ftp://ftp.datasus.gov.br/dissemin/publicos/SIM/PRELIM/DOFET/DOEXT{yy}.dbc",
]

# Colunas do SIM que REALMENTE sao usadas pelo seed (schema traffic_deaths)
USED_COLUMNS = {
    "CONTADOR", "ORIGEM", "TIPOBITO", "DTOBITO", "HORAOBITO",
    "NATURAL", "CODMUNNATU", "DTNASC", "IDADE", "SEXO",
    "RACACOR", "ESTCIV", "ESC", "ESC2010", "SERIESCFAL",
    "OCUP", "CODMUNRES", "LOCOCOR", "CODESTAB", "ESTABDESCR",
    "CODMUNOCOR",
    "LINHAA", "LINHAB", "LINHAC", "LINHAD", "LINHAII",
    "CAUSABAS", "CAUSABAS_O", "CB_PRE",
    "CIRCOBITO", "ACIDTRAB", "FONTE",
    "ASSISTMED", "EXAME", "CIRURGIA", "NECROPSIA",
    "NUMEROLOTE", "TPPOS",
    "DTINVESTIG", "DTCADASTRO", "ATESTANTE", "STCODIFICA", "CODIFICADO",
    "VERSAOSIST", "VERSAOSCB",
    "DTRECEBIM", "DTRECORIGA",
    "NUDIASOBCO", "NUDIASOBIN", "NUDIASINF",
    "DTCADINV", "DTATESTADO", "DTCONINV", "DTCONCASO",
    "COMUNSVOIM",
    # Mantem tambem colunas-mae e gestacao (seed pode usar no futuro)
    "IDADEMAE", "ESCMAE", "ESCMAE2010", "SERIESCMAE", "OCUPMAE",
    "QTDFILVIVO", "QTDFILMORT",
    "GRAVIDEZ", "SEMAGESTAC", "GESTACAO", "PARTO",
    "OBITOPARTO", "PESO", "TPMORTEOCO", "OBITOGRAV", "OBITOPUERP",
    # Colunas de investigacao (seed usa em algumas queries)
    "FONTEINV", "ATESTADO", "CAUSAMAT",
    "ESCMAEAGR1", "ESCFALAGR1",
    "STDOEPIDEM", "STDONOVA",
    "DIFDATA", "DTCADINF",
    "TPOBITOCOR", "FONTES", "TPRESGINFO", "TPNIVELINV",
    "MORTEPARTO", "FONTESINF", "ALTCAUSA",
}


def find_dbc_files(source_dir):
    """Encontra todos os arquivos .dbc no diretorio."""
    return sorted(Path(source_dir).glob("*.dbc"))


def _try_download(url, dest_file, year):
    """Tenta baixar de uma URL. Retorna True se sucesso, False se falhou."""
    print(f"  [{year}] Baixando {url} ...", end=" ", flush=True)
    try:
        subprocess.run(
            ["wget", "-q", "--show-progress", "-O", str(dest_file), url],
            check=True,
            timeout=120,
        )
        size_mb = dest_file.stat().st_size / (1024 * 1024)
        print(f"{size_mb:.1f} MB")
        return True
    except subprocess.CalledProcessError as e:
        print(f"falhou (exit {e.returncode})")
        if dest_file.exists():
            dest_file.unlink()
        return False
    except subprocess.TimeoutExpired:
        print("ERRO: timeout (120s)")
        if dest_file.exists():
            dest_file.unlink()
        return False


def download_datasus(years, dest_dir, dry_run=False):
    """Baixa arquivos DBC do DATASUS FTP para o diretorio de destino.
    Tenta cada URL em DATASUS_FTPS em ordem (CID10, depois PRELIM como fallback)."""
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    downloaded = []
    for year in years:
        yy = str(year)[-2:]
        dest_file = dest_dir / f"DOEXT{yy}.dbc"

        if dest_file.exists():
            print(f"  [{year}] {dest_file.name} ja existe, pulando download")
            downloaded.append(dest_file)
            continue

        if dry_run:
            url = DATASUS_FTPS[0].format(yy=yy)
            print(f"  [{year}] [DRY RUN] Baixaria: {url} -> {dest_file}")
            downloaded.append(dest_file)
            continue

        success = False
        for ftp_url in DATASUS_FTPS:
            url = ftp_url.format(yy=yy)
            if _try_download(url, dest_file, year):
                downloaded.append(dest_file)
                success = True
                break

        if not success:
            print(f"  [{year}] ERRO: falha em todas as URLs tentadas para DOEXT{yy}.dbc")

    return downloaded


def detect_year(filename):
    """Tenta extrair o ano do nome do arquivo (ex: DO2024.dbc -> 2024, DOEXT24.dbc -> 2024)."""
    name = str(filename)
    # Padrao DATASUS: DOEXT24.dbc, DOEXT{YY}.dbc
    m = re.search(r"DOEXT(\d{2})\.dbc$", name, re.IGNORECASE)
    if m:
        return 2000 + int(m.group(1))
    # Padrao: mortes_transito_2023.csv, DO2024.dbc
    m = re.search(r"20(\d{2})", name)
    if m:
        return int("20" + m.group(1))
    return None


def dbc_to_records(dbc_path):
    """Descomprime DBC -> DBF temporario e le os registros. Retorna (field_names, records)."""
    dbf_path = dbc_path.with_suffix(".dbf")

    print(f"  Descomprimindo DBC -> DBF...", end=" ", flush=True)
    readdbc.dbc2dbf(str(dbc_path), str(dbf_path))
    size_mb = dbf_path.stat().st_size / (1024 * 1024)
    print(f"{size_mb:.1f} MB")

    table = DBF(str(dbf_path), encoding="cp1252", char_decode_errors="replace")
    field_names = [f.upper() for f in table.field_names]
    records = []

    for row in table:
        rec = {k.upper(): v for k, v in row.items()}
        records.append(rec)

    return field_names, records


def filter_traffic_deaths(records, include_y=False):
    """Filtra apenas mortes de transito (CAUSABAS com V% ou Y%)."""
    filtered = []
    skipped = 0
    for rec in records:
        causabas = str(rec.get("CAUSABAS", "") or "").strip().upper().lstrip("*")
        if causabas.startswith("V"):
            filtered.append(rec)
        elif include_y and (causabas.startswith("Y85") or causabas.startswith("Y86")):
            filtered.append(rec)
        else:
            skipped += 1
    return filtered, skipped


def clean_value(val):
    """Converte valores do DBF para o formato esperado no CSV."""
    if val is None:
        return "NA"
    s = str(val).strip()
    if not s or s in ("None", "nan", ""):
        return "NA"
    return s


def write_csv(records, field_names, output_path, strip_columns=False):
    """Escreve os registros filtrados em CSV (formato SIM)."""
    if strip_columns:
        write_fields = [f for f in field_names if f in USED_COLUMNS]
    else:
        write_fields = field_names

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, quoting=csv.QUOTE_ALL)

        # Header: nome das colunas em maiusculo
        writer.writerow(write_fields)

        for rec in records:
            row = [clean_value(rec.get(f)) for f in write_fields]
            writer.writerow(row)

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Converte DBC do DATASUS para CSV de mortes de transito")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--source-dir", type=str, help="Pasta com os arquivos .dbc")
    group.add_argument("--download", type=str, help="Baixar anos do DATASUS FTP (ex: '2024,2025' ou '2016-2026')")
    parser.add_argument("--output-dir", type=str, default=str(DEFAULT_OUTPUT_DIR), help="Pasta de saida dos CSV")
    parser.add_argument("--include-y", action="store_true", help="Incluir sequelas Y85/Y86 alem de V%%")
    parser.add_argument("--strip-columns", action="store_true", help="Remover colunas nao usadas pelo seed")
    parser.add_argument("--rm", action="store_true", help="Apagar arquivos DBC apos conversao bem-sucedida")
    parser.add_argument("--dry-run", action="store_true", help="Apenas preview, nao escreve arquivos")
    args = parser.parse_args()

    # Resolve source-dir
    if args.download:
        source_dir = Path(args.source_dir) if args.source_dir else DEFAULT_SOURCE_DIR
        years = []
        for part in args.download.split(","):
            part = part.strip()
            if part.isdigit() and len(part) == 4:
                years.append(int(part))
            elif "-" in part:
                parts = part.split("-")
                if len(parts) == 2 and all(p.strip().isdigit() and len(p.strip()) >= 2 for p in parts):
                    start = int(parts[0].strip())
                    end_raw = parts[1].strip()
                    if len(end_raw) == 2:
                        # 2016-26 -> 2016 a 2026
                        prefix = str(start)[:2]
                        end = int(prefix + end_raw)
                    else:
                        end = int(end_raw)
                    if start > end:
                        start, end = end, start
                    years.extend(range(start, end + 1))
                else:
                    print(f"ERRO: range invalido: '{part}'. Use AAAA-AAAA (ex: 2016-2026)", file=sys.stderr)
                    return 1
            else:
                print(f"ERRO: ano invalido: '{part}'. Use AAAA (ex: 2024) ou AAAA-AAAA (ex: 2016-2026)", file=sys.stderr)
                return 1
        if not years:
            return 1

        print(f"Baixando dados do DATASUS FTP para: {source_dir}")
        dbc_files = download_datasus(years, source_dir, dry_run=args.dry_run)
        if not dbc_files:
            print("Nenhum arquivo baixado.")
            return 1
        print()
    else:
        source_dir = Path(args.source_dir)
        if not source_dir.exists():
            print(f"ERRO: diretorio de origem nao encontrado: {source_dir}", file=sys.stderr)
            return 1
        dbc_files = find_dbc_files(source_dir)
        if not dbc_files:
            print(f"Nenhum arquivo .dbc encontrado em {source_dir}", file=sys.stderr)
            return 1

    output_dir = Path(args.output_dir)
    if not args.dry_run:
        output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Encontrados {len(dbc_files)} arquivo(s) .dbc:")
    for f in dbc_files:
        print(f"  {f.name}")

    v_filter = "V% e Y85/Y86" if args.include_y else "V%"
    print(f"\nFiltro CID: {v_filter}")
    if args.strip_columns:
        print(f"Strip colunas: sim ({len(USED_COLUMNS)} mantidas de 87)")
    print()

    total_processed = 0
    total_kept = 0
    total_skipped = 0

    for dbc_path in dbc_files:
        year = detect_year(dbc_path.name)
        if not year:
            print(f"AVISO: nao foi possivel detectar ano de {dbc_path.name}, pulando")
            continue

        output_filename = f"mortes_transito_{year}.csv"
        output_path = output_dir / output_filename

        if not args.dry_run and output_path.exists():
            resp = input(f"  {output_filename} ja existe. Sobrescrever? [s/N] ")
            if resp.lower() != "s":
                print(f"  Pulando {dbc_path.name}")
                continue

        print(f"Processando: {dbc_path.name} -> {output_filename} (ano {year})")

        if args.dry_run:
            print(f"  [DRY RUN] Pularia leitura e gravacao")
            continue

        print(f"  Lendo DBC...", end=" ", flush=True)
        field_names, records = dbc_to_records(dbc_path)
        print(f"{len(records):,} registros")

        filtered, skipped = filter_traffic_deaths(records, include_y=args.include_y)
        print(f"  Filtrados: {len(filtered):,} mantidos (causa V/Y), {skipped:,} removidos")

        output_path = write_csv(filtered, field_names, output_path, strip_columns=args.strip_columns)
        size_mb = output_path.stat().st_size / (1024 * 1024)
        print(f"  CSV salvo: {output_path} ({size_mb:.1f} MB)")

        total_processed += len(records)
        total_kept += len(filtered)
        total_skipped += skipped

        if args.rm:
            dbc_path.unlink()
            print(f"  DBC removido: {dbc_path.name}")
            dbf_temp = dbc_path.with_suffix(".dbf")
            if dbf_temp.exists():
                dbf_temp.unlink()
                print(f"  DBF temporario removido: {dbf_temp.name}")

        print()

    print(f"{'='*60}")
    print(f"Total processado: {total_processed:,} registros")
    print(f"  Mantidos: {total_kept:,} ({total_kept/max(total_processed,1)*100:.1f}%)")
    print(f"  Removidos: {total_skipped:,} ({total_skipped/max(total_processed,1)*100:.1f}%)")

    if args.dry_run:
        print("[DRY RUN] Nenhum arquivo foi escrito.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
