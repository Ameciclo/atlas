#!/usr/bin/env python3
"""
Apply manual equipment corrections (equipment-corrections.tsv) into
semaphore-street-map.tsv and post-street-map.tsv.

Run after reviewing/correcting equipment matches on the verification UI.
Then re-run build-location-descriptions.py so it uses the corrected maps.

Usage: python3 apply-equipment-corrections.py
"""

import csv
import os
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(DIR)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(DIR)))))
DATA_DIR = os.path.join(ROOT, "packages", "database", "seed-data", "traffic-tickets")
CORRECTIONS_FILE = os.path.join(PARENT, "location-verification", "equipment-corrections.tsv")
SEM_MAP_FILE = os.path.join(DATA_DIR, "semaphore-street-map.tsv")
POST_MAP_FILE = os.path.join(DATA_DIR, "post-street-map.tsv")


def load_corrections():
    corrections = []
    raw = []
    with open(CORRECTIONS_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            corrected_code = row.get("corrected_code", "").strip()
            corrected_name = row.get("corrected_name", "").strip()
            if not corrected_code or not corrected_name:
                continue
            corrections.append({
                "equip_type": row["equip_type"].strip(),
                "equip_id": row["equip_id"].strip(),
                "location_index": row.get("location_index", "").strip(),
                "corrected_code": corrected_code,
                "corrected_name": corrected_name,
            })
            raw.append(row)
    return corrections


def apply_to_semaphore_map(corrections):
    sem_corrections = {c["equip_id"] + "." + c["location_index"]: c
                       for c in corrections if c["equip_type"] == "sem"}
    if not sem_corrections:
        return 0

    rows = []
    updated = 0
    with open(SEM_MAP_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        fieldnames = reader.fieldnames
        for row in reader:
            key = row["semaforo"].strip() + "." + row.get("location_index", "").strip()
            corr = sem_corrections.get(key)
            if corr:
                old_code = row["street_code"]
                old_name = row["street_name"]
                row["street_code"] = corr["corrected_code"]
                row["street_name"] = corr["corrected_name"]
                updated += 1
                print(f"  S{row['semaforo']}.{row.get('location_index','')}  "
                      f"[{old_code}] {old_name[:40]}  ->  "
                      f"[{corr['corrected_code']}] {corr['corrected_name'][:40]}")
            rows.append(row)

    with open(SEM_MAP_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t",
                                lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    return updated


def apply_to_post_map(corrections):
    post_corrections = {c["equip_id"]: c
                        for c in corrections if c["equip_type"] == "post"}
    if not post_corrections:
        return 0

    rows = []
    updated = 0
    with open(POST_MAP_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        fieldnames = reader.fieldnames
        for row in reader:
            key = row["post_code"].strip()
            corr = post_corrections.get(key)
            if corr:
                old_code = row["street_code"]
                old_name = row["street_name"]
                row["street_code"] = corr["corrected_code"]
                row["street_name"] = corr["corrected_name"]
                updated += 1
                print(f"  {row['post_code']}  "
                      f"[{old_code}] {old_name[:40]}  ->  "
                      f"[{corr['corrected_code']}] {corr['corrected_name'][:40]}")
            rows.append(row)

    with open(POST_MAP_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t",
                                lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)

    return updated


def main():
    if not os.path.exists(CORRECTIONS_FILE):
        print(f"Corrections file not found: {CORRECTIONS_FILE}")
        print("Nothing to apply.")
        return

    corrections = load_corrections()
    if not corrections:
        print("No corrections to apply (all entries are verified=true with no corrected_code).")
        return

    print(f"Loaded {len(corrections)} corrections from equipment-corrections.tsv\n")

    print("=== Applying semaphore corrections ===")
    sem_updated = apply_to_semaphore_map(corrections)
    print(f"  {sem_updated} semaphore entries updated\n")

    print("=== Applying post corrections ===")
    post_updated = apply_to_post_map(corrections)
    print(f"  {post_updated} post entries updated\n")

    print(f"Done. {sem_updated + post_updated} total entries updated.")
    print(f"Re-run build-location-descriptions.py --apply to regenerate location-descriptions.tsv.")


if __name__ == "__main__":
    main()
