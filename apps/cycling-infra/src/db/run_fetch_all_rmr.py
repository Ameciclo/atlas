#!/usr/bin/env python3
"""
Runner script: fetch cycling infrastructure for ALL RMR cities.
Uses the area-based Overpass query (like ciclomapa's approach).

Usage:
  python run_fetch_all_rmr.py
  python run_fetch_all_rmr.py --skip-recife
  python run_fetch_all_rmr.py --sleep 3
"""
import argparse
import glob
import json
import os
import sys
import subprocess
import time

RMR_CITIES = [
    (2600054, "Abreu e Lima"),
    (2601052, "Araçoiaba"),
    (2602902, "Cabo de Santo Agostinho"),
    (2603454, "Camaragibe"),
    (2606804, "Igarassu"),
    (2607208, "Ipojuca"),
    (2607604, "Ilha de Itamaracá"),
    (2607752, "Itapissuma"),
    (2607901, "Jaboatão dos Guararapes"),
    (2609402, "Moreno"),
    (2609600, "Olinda"),
    (2610707, "Paulista"),
    (2611606, "Recife"),
    (2613701, "São Lourenço da Mata"),
]


def main():
    parser = argparse.ArgumentParser(description="Fetch all RMR cities")
    parser.add_argument("--skip-recife", action="store_true", help="Skip Recife")
    parser.add_argument("--sleep", type=float, default=3, help="Seconds between cities")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    fetch_script = os.path.join(script_dir, "fetch_city_cycling_infra.py")

    if not os.path.exists(fetch_script):
        print(f"Error: {fetch_script} not found")
        sys.exit(1)

    for city_id, city_name in RMR_CITIES:
        if args.skip_recife and city_id == 2611606:
            print(f"\nSkipping {city_name} (--skip-recife)")
            continue

        print(f"\n{'='*60}")
        print(f"Fetching: {city_name} (IBGE: {city_id})")
        print(f"{'='*60}")

        cmd = [
            sys.executable, fetch_script,
            "--city", city_name,
            "--state", "Pernambuco",
            "--city-id", str(city_id),
            "--output-dir", args.output_dir,
        ]

        try:
            result = subprocess.run(cmd, cwd=args.output_dir, check=True)
            if result.returncode != 0:
                print(f"  WARNING: {city_name} returned code {result.returncode}")
        except subprocess.CalledProcessError as e:
            print(f"  ERROR: {city_name} failed: {e}")
        except KeyboardInterrupt:
            print("\nInterrupted by user")
            sys.exit(1)

        print(f"\nWaiting {args.sleep}s before next city...")
        time.sleep(args.sleep)

    print(f"\n{'='*60}")
    print("ALL CITIES PROCESSED!")
    print(f"{'='*60}")

    # Show summary of generated files
    files = glob.glob(os.path.join(args.output_dir, "*_ways.json"))
    if files:
        print(f"\nGenerated ways files:")
        total_km = 0
        total_ways = 0
        for f in sorted(files):
            try:
                with open(f, encoding="utf-8") as fh:
                    data = json.load(fh)
                km = sum(w.get("length", 0) for w in data)
                print(f"  {os.path.basename(f)}: {len(data)} ways, {km:.2f} km")
                total_km += km
                total_ways += len(data)
            except Exception as e:
                print(f"  {os.path.basename(f)}: error reading - {e}")
        print(f"\n  TOTAL: {total_ways} ways, {total_km:.2f} km")


if __name__ == "__main__":
    main()
