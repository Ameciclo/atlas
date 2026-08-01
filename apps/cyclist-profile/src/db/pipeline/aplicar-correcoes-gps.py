#!/usr/bin/env python3
"""
Aplica correções de GPS no seed data do cyclist-profiles.
Usa o crosswalk-v2-relatorio.csv como fonte das correções.
"""

import csv
import json
import sys

CSV_PATH = "apps/cyclist-profile/src/db/pipeline/crosswalk-relatorio.csv"
SEED_PATH = "packages/database/seed-data/cyclist-profiles/data.json"

# Correções manuais (locais que o crosswalk não detectou)
MANUAIS = {
    ("Avenida Cruz Cabugá x Avenida Norte Miguel Arraes de Alencar", "2018"): (-8.04756, -34.87696),
    ("Avenida do Forte do Bom Jesus x Rua Gomes Taborda", "2018"): (-8.05351, -34.92892),
    ("Avenida do Forte do Bom Jesus x Rua Gomes Taborda", "2021"): (-8.05351, -34.92892),
    ("Avenida do Forte do Bom Jesus x Rua Gomes Taborda", "2024"): (-8.05351, -34.92892),
}

def main():
    # 1. Ler CSV e extrair correções
    correcoes: dict[tuple[str, str], tuple[float, float]] = {}
    with open(CSV_PATH, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("precisa_corrigir", "").strip().upper() == "SIM":
                street = row["survey_street"].strip()
                year = row["survey_year"].strip()
                lat = float(row["counting_lat"])
                lon = float(row["counting_lon"])
                correcoes[(street, year)] = (lat, lon)

    # Adiciona manuais
    for (street, year), (lat, lon) in MANUAIS.items():
        correcoes[(street, year)] = (lat, lon)

    print(f"Correções carregadas: {len(correcoes)}")
    for (street, year), (lat, lon) in sorted(correcoes.items()):
        print(f"  {year} | {street[:60]} → ({lat}, {lon})")

    # 2. Ler seed data
    print(f"\nLendo seed data: {SEED_PATH} ...")
    with open(SEED_PATH) as f:
        data = json.load(f)
    print(f"  {len(data)} registros carregados")

    # 3. Aplicar correções
    atualizados = 0
    matches_por_regra = {}
    for item in data:
        meta = item.get("metadata")
        if not meta:
            continue
        street = meta.get("street", "").strip()
        year = str(meta.get("survey_year", ""))
        key = (street, year)

        if key in correcoes:
            lat, lon = correcoes[key]
            old_coords = meta.get("location", {}).get("coordinates", [])
            meta["location"]["coordinates"] = [lat, lon]
            atualizados += 1
            if key not in matches_por_regra:
                matches_por_regra[key] = 0
            matches_por_regra[key] += 1

    # 4. Relatório
    print(f"\nTotal de registros atualizados: {atualizados}")
    for (street, year), count in sorted(matches_por_regra.items()):
        print(f"  {count:4d} registros: {year} | {street[:60]}")

    # 5. Salvar
    print(f"\nSalvando {SEED_PATH} ...")
    with open(SEED_PATH, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("Pronto.")


if __name__ == "__main__":
    main()
