#!/usr/bin/env python3
"""
Remove non-PDC ways whose osm_id already exists in pdc_ways.json.

One-time cleanup script to fix the existing overlap between the two files.
After running, re-seed the database: pnpm db:seed --only=cycling-infra

Usage:
  python dedup_non_pdc.py
"""
import json
import os


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    pdc_path = os.path.join(script_dir, "pdc_ways.json")
    non_pdc_path = os.path.join(script_dir, "non_pdc_ways.json")

    with open(pdc_path) as f:
        pdc_data = json.load(f)
    pdc_ids = {w["osm_id"] for w in pdc_data}

    with open(non_pdc_path) as f:
        non_pdc_data = json.load(f)

    before = len(non_pdc_data)
    before_km = sum(w.get("length", 0) for w in non_pdc_data)

    # Remove ways already in pdc_ways.json
    clean = [w for w in non_pdc_data if w["osm_id"] not in pdc_ids]

    after = len(clean)
    after_km = sum(w.get("length", 0) for w in clean)
    removed = before - after
    removed_km = before_km - after_km

    with open(non_pdc_path, "w", encoding="utf-8") as f:
        json.dump(clean, f, indent=2, ensure_ascii=False)

    print(f"Before: {before} ways, {before_km:.1f} km")
    print(f"Removed: {removed} ways, {removed_km:.1f} km (overlap with pdc_ways.json)")
    print(f"After: {after} ways, {after_km:.1f} km")
    print(f"Saved to: {non_pdc_path}")


if __name__ == "__main__":
    main()
