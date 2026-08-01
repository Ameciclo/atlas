#!/usr/bin/env python3
"""
Convert location-descriptions.json → location-descriptions.tsv
One-time migration: the pipeline now outputs TSV directly.
"""
import json
import csv
import os

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(DIR)))))
DATA_DIR = os.path.join(ROOT, "packages", "database", "seed-data", "traffic-tickets")
JSON_PATH = os.path.join(DATA_DIR, "location-descriptions.json")
TSV_PATH = os.path.join(DATA_DIR, "location-descriptions.tsv")

print(f"Reading {JSON_PATH}...")
with open(JSON_PATH, "r", encoding="utf-8") as f:
    data = json.load(f)
print(f"  {len(data):,} entries loaded")

print(f"Writing {TSV_PATH}...")
with open(TSV_PATH, "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, delimiter="\t", lineterminator="\n")
    w.writerow([
        "location_id", "raw_description", "extracted_street",
        "street_type", "street_code", "semaphore_number",
        "address_number", "direction", "reference_point",
    ])

    for raw, e in data.items():
        ref = e.get("equipment_address", "") or ""
        cross = e.get("cross_street", "") or ""
        if ref and cross:
            ref = f"{ref} ({cross})"
        elif not ref:
            ref = cross

        w.writerow([
            e["id"],
            raw.replace("\t", " ").replace("\n", " "),
            e.get("street_name_matched", "") or "",
            e.get("street_type", "") or "",
            e.get("street_code", "") or "",
            e.get("equipment_number", "") or "",
            e.get("address_number", "") or "",
            e.get("direction", "") or "",
            ref.replace("\t", " ").replace("\n", " "),
        ])

size = os.path.getsize(TSV_PATH)
print(f"  TSV: {size / 1024 / 1024:.1f} MB")
print("Done.")
