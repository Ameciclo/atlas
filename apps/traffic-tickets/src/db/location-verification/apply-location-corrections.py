#!/usr/bin/env python3
"""
Aplica as correcoes do results.tsv no location-descriptions.tsv.

Para cada entrada com verified='false' no results.tsv:
  - Sobrescreve extracted_street com corrected_street
  - Sobrescreve street_code com corrected_street_code

Entradas com verified='true' (match original correto) nao sao alteradas.
Entradas com verified='limbo' ou vazio sao ignoradas.

Gera backup do location-descriptions.tsv original antes de modificar.
"""

import csv
import shutil
import sys
from datetime import datetime
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent.parent.parent.parent
SEED_DATA = ROOT / "packages" / "database" / "seed-data" / "traffic-tickets"
DATA_DIR = SEED_DATA
LOCATIONS_FILE = DATA_DIR / "location-descriptions.tsv"
RESULTS_FILE = SCRIPT_DIR / "results.tsv"


def main():
    if not RESULTS_FILE.exists():
        print(f"ERRO: results.tsv nao encontrado em {RESULTS_FILE}")
        print("Exporte primeiro: python server.py e depois Ctrl+C (exporta ao sair)")
        return 1

    if not LOCATIONS_FILE.exists():
        print(f"ERRO: location-descriptions.tsv nao encontrado em {LOCATIONS_FILE}")
        return 1

    print(f"Lendo correcoes de: {RESULTS_FILE}")
    corrections = {}
    total = 0
    with open(RESULTS_FILE, "r") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            total += 1
            verified = row.get("verified", "").strip()
            if verified != "false":
                continue
            corrected_street = row.get("corrected_street", "").strip()
            corrected_code = row.get("corrected_street_code", "").strip()
            if not corrected_street and not corrected_code:
                continue
            corrections[row["location_id"]] = (corrected_street, corrected_code)

    print(f"  {total:,} entradas em results.tsv")
    print(f"  {len(corrections):,} correcoes para aplicar (verified='false')")

    if not corrections:
        print("Nada a aplicar.")
        return 0

    backup_path = LOCATIONS_FILE.with_suffix(".tsv.bak-" + datetime.now().strftime("%Y%m%d-%H%M%S"))
    print(f"\nBackup: {backup_path}")
    shutil.copy2(LOCATIONS_FILE, backup_path)

    print(f"Processando: {LOCATIONS_FILE}")
    updated = 0
    skipped = 0
    total_rows = 0

    output_path = LOCATIONS_FILE.with_suffix(".tsv.tmp")
    with open(LOCATIONS_FILE, "r") as fin, open(output_path, "w", newline="") as fout:
        reader = csv.DictReader(fin, delimiter="\t")
        writer = csv.DictWriter(fout, fieldnames=reader.fieldnames, delimiter="\t", extrasaction="ignore")
        writer.writeheader()

        for row in reader:
            total_rows += 1
            loc_id = row["location_id"]

            if loc_id in corrections:
                new_street, new_code = corrections[loc_id]
                old_street = row.get("extracted_street", "")
                old_code = row.get("street_code", "")

                if old_street == new_street and old_code == new_code:
                    skipped += 1
                else:
                    row["extracted_street"] = new_street
                    row["street_code"] = new_code
                    updated += 1

            writer.writerow(row)

            if total_rows % 100000 == 0:
                print(f"  {total_rows:,} linhas processadas...", flush=True)

    output_path.replace(LOCATIONS_FILE)

    print(f"\n  {total_rows:,} localizacoes processadas")
    print(f"  {updated:,} corrigidas")
    print(f"  {skipped:,} ja estavam corretas (puladas)")
    print(f"  {len(corrections) - updated - skipped:,} correcoes para IDs nao encontrados no TSV")
    print(f"\nPronto. Backup em: {backup_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
