#!/usr/bin/env python3
"""
Merge city-specific ways files into non_pdc_ways.json for the seed script.

Usage:
  python merge_city_data.py
"""
import glob
import json
import os

RMR_CITIES_IBGE = {
    2600054: "Abreu e Lima",
    2601052: "Araçoiaba",
    2602902: "Cabo de Santo Agostinho",
    2603454: "Camaragibe",
    2606804: "Igarassu",
    2607208: "Ipojuca",
    2607604: "Ilha de Itamaracá",
    2607752: "Itapissuma",
    2607901: "Jaboatão dos Guararapes",
    2609402: "Moreno",
    2609600: "Olinda",
    2610707: "Paulista",
    2611606: "Recife",
    2613701: "São Lourenço da Mata",
}

STATE = "Pernambuco"


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    # Find all city ways files
    ways_files = sorted(glob.glob(os.path.join(script_dir, "*_ways.json")))
    ways_files = [f for f in ways_files if not any(
        x in os.path.basename(f) for x in [
            "pdc_ways", "non_pdc_ways", "osm_ways_data",
            "ciclomapa_ways", "processed_ways"
        ]
    )]

    all_non_pdc = []
    seen_ids = set()

    for ways_file in ways_files:
        filename = os.path.basename(ways_file)
        print(f"Processing {filename}...")

        with open(ways_file, encoding="utf-8") as f:
            ways = json.load(f)

        # Add to non_pdc_ways (dedup by osm_id)
        for w in ways:
            oid = w.get("osm_id")
            if oid and oid not in seen_ids:
                seen_ids.add(oid)
                w["relation_id"] = 0
                all_non_pdc.append(w)

    # Save non_pdc_ways.json
    non_pdc_path = os.path.join(script_dir, "non_pdc_ways.json")
    with open(non_pdc_path, "w", encoding="utf-8") as f:
        json.dump(all_non_pdc, f, indent=2, ensure_ascii=False)

    total_km = sum(w.get("length", 0) for w in all_non_pdc)
    print(f"\nnon_pdc_ways.json: {len(all_non_pdc)} ways, {total_km:.2f} km total")
    print(f"Saved to: {non_pdc_path}")

    # Summary by city
    print(f"\n{'='*60}")
    print("SUMMARY BY CITY")
    print(f"{'='*60}")
    for city_id in sorted(RMR_CITIES_IBGE):
        city_ways = [w for w in all_non_pdc if w.get("city_id") == city_id]
        if city_ways:
            by_type = {}
            for w in city_ways:
                t = w.get("cycleway_typology", "unknown")
                by_type[t] = by_type.get(t, 0) + w.get("length", 0)
            total = sum(by_type.values())
            details = ", ".join(f"{t}: {v:.2f}km" for t, v in sorted(by_type.items()))
            print(f"  {RMR_CITIES_IBGE[city_id]:30s}: {total:7.2f} km ({details})")
        else:
            print(f"  {RMR_CITIES_IBGE[city_id]:30s}: no data")


if __name__ == "__main__":
    main()
