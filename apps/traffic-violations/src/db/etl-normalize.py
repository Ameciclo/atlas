#!/usr/bin/env python3
"""
ETL: Normalize v3 semicolon CSV files -> unified infracoes_reduzido.tsv + extended location dict.
Usage: python3 etl-normalize.py [--apply]
  --apply   Actually write output files (otherwise dry-run)
"""

import csv
import json
import os
import re
import sys
from collections import Counter

DIR = os.path.dirname(os.path.abspath(__file__))
INFRA_DIR = os.path.join(DIR, "all-infracoes")
OUT_TSV = os.path.join(DIR, "infracoes_reduzido_v2.tsv")
OUT_DICT = os.path.join(DIR, "dict_locais_v3.json")
OUT_SQL = os.path.join(DIR, "migrations/0001_seed_traffic_locations.sql")

APPLY = "--apply" in sys.argv

# ---------------------------------------------------------------------------
# Load existing dictionaries
# ---------------------------------------------------------------------------

with open(os.path.join(DIR, "dict_agentes_v2.json")) as f:
    agentes_map = json.load(f)  # {"Código 3 - LOMBADA...": 3, ...}

with open(os.path.join(DIR, "dict_infracoes_v2.json")) as f:
    infracoes_map = json.load(f)  # {"7455|Art. 218...|Desc...": 0, ...}

with open(os.path.join(DIR, "dict_locais_v2.json")) as f:
    locais_map = json.load(f)  # {"RUA TAL...": 0, ...}

# Build reverse lookup for infracoes: code|law_code|description -> id
# But the v3 files have the description in the data, so we match on first 3 fields

def build_infracao_key(code, law, desc):
    """Normalize infraction code and build lookup key."""
    code = code.strip().replace(",0", "").replace(",", "")
    law = law.strip()
    desc = desc.strip()
    return f"{code}|{law}|{desc}"

infracoes_lookup = {}
for k, v in infracoes_map.items():
    parts = k.split("|", 2)
    if len(parts) >= 3:
        normalized = f"{parts[0]}|{parts[1].upper()}|{re.sub(r'\s+', ' ', parts[2].strip())}"
    else:
        normalized = k.upper() if len(parts) <= 2 else k
    infracoes_lookup[normalized] = v

# ---------------------------------------------------------------------------
# V3 file definitions
# ---------------------------------------------------------------------------

V3_FILES = {
    "2021": os.path.join(INFRA_DIR, "6bf55076-5aaa-4bf5-9f45-5a57352ac0c8.tsv"),
    "2022": os.path.join(INFRA_DIR, "896622f2-4104-4c6b-acc5-bded85fa8a26.tsv"),
    "2023": os.path.join(INFRA_DIR, "9eabe813-a17c-4e8f-b91d-66ba7d4c269f.tsv"),
    "2024": os.path.join(INFRA_DIR, "fd97260b-4a91-4c6a-ad14-7285e5f6ed9a.tsv"),
    "2025": os.path.join(INFRA_DIR, "16db0dcc-f871-46ee-8e0e-457072b5f940.tsv"),
}

# ---------------------------------------------------------------------------
# Normalize date from various formats
# ---------------------------------------------------------------------------

def normalize_date(date_str: str) -> str:
    """Return YYYY-MM-DD from DD/MM/YYYY, YYYY-MM-DD, or YYYY-MM-DDTHH:MM:SS."""
    date_str = date_str.strip()
    # DD/MM/YYYY HH:MM
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})\s", date_str)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    # DD/MM/YYYY
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})$", date_str)
    if m:
        return f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    # YYYY-MM-DDTHH:MM:SS
    m = re.match(r"(\d{4}-\d{2}-\d{2})T", date_str)
    if m:
        return m.group(1)
    # YYYY-MM-DD
    m = re.match(r"(\d{4}-\d{2}-\d{2})$", date_str)
    if m:
        return m.group(1)
    return date_str[:10] if len(date_str) >= 10 else date_str

def normalize_time(time_str: str) -> str:
    """Return HH:MM:SS or HH:MM from various time formats."""
    time_str = time_str.strip()
    m = re.match(r"(\d{2}:\d{2}:\d{2})", time_str)
    if m:
        return m.group(1)
    m = re.match(r"(\d{2}:\d{2})", time_str)
    if m:
        return m.group(1) + ":00"
    return time_str[:8] if len(time_str) >= 8 else time_str + ":00"

# ---------------------------------------------------------------------------
# Lookup agent ID
# ---------------------------------------------------------------------------

def lookup_agent(raw_agent: str) -> int:
    """Map agent description text to integer ID."""
    raw = raw_agent.strip()
    if not raw:
        return -1  # skip empty agents

    # Clean ,0 suffix (2022 data artifact)
    raw = raw.replace(",0", "").strip()

    # Try exact match first
    if raw in agentes_map:
        return agentes_map[raw]
    # Try matching by code prefix ("Código 3 - ...")
    m = re.match(r"C[oó]digo\s*(\d+)", raw)
    if m:
        agent_id = int(m.group(1))
        for k, v in agentes_map.items():
            if v == agent_id:
                return agent_id
        # If code number not in dict, register it with the code as ID
        return agent_id
    # Fallback: try numeric ID
    if raw.isdigit():
        return int(raw)
    print(f"  WARNING: unknown agent: {raw[:60]}")
    return -1

# ---------------------------------------------------------------------------
# Lookup infraction ID
# ---------------------------------------------------------------------------

def lookup_infracao(code: str, law: str, desc: str) -> int:
    """Map infraction code + law + description to integer ID."""
    code_clean = code.strip().replace(",0", "").replace(",", "")
    law_clean = law.strip().upper()  # normalize casing (Art., ARt., ART., art.)
    desc_clean = re.sub(r"\s+", " ", desc.strip())
    key = f"{code_clean}|{law_clean}|{desc_clean}"
    if key in infracoes_lookup:
        return infracoes_lookup[key]
    # Fuzzy: try matching by code + law only
    for k, v in infracoes_map.items():
        parts = k.split("|", 2)
        if len(parts) >= 2 and parts[0] == code_clean and parts[1].upper() == law_clean:
            return v
    # Fallback: use code as ID
    return -1

# ---------------------------------------------------------------------------
# Assign location ID
# ---------------------------------------------------------------------------

next_location_id = max(int(v) for v in locais_map.values()) + 1
new_locations = {}  # raw_description -> location_id for new entries

def lookup_location(raw_loc: str, year: str) -> int:
    """Map raw location text to integer ID, assigning new IDs as needed."""
    global next_location_id
    loc = raw_loc.strip()
    if loc in locais_map:
        return int(locais_map[loc])
    if loc in new_locations:
        return new_locations[loc]
    lid = next_location_id
    new_locations[loc] = lid
    next_location_id += 1
    return lid

# ---------------------------------------------------------------------------
# Process one v3 file
# ---------------------------------------------------------------------------

def process_file(filepath: str, year: str, writer):
    """Read a semicolon CSV file and write normalized TSV rows.
    
    Detects column order per-row (the 2022 file has rows with both orderings concatenated).
    """
    rows = 0
    skipped = 0
    unknown_agents = set()
    unknown_infr = set()

    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter=";")
        header = next(reader)  # skip header

        for row in reader:
            if len(row) < 8:
                skipped += 1
                continue

            datainfracao = row[0].strip().replace('"', '')
            horainfracao = row[1].strip().replace('"', '')
            agenteequipamento = row[3].strip().replace('"', '')
            infracao = row[4].strip().replace('"', '')
            descricaoinfracao = row[5].strip().replace('"', '')

            # Auto-detect column order per row: law article starts with "Art."
            # Some 2022 rows have swapped col6/col7
            val6 = row[6].strip().replace('"', '') if len(row) > 6 else ""
            val7 = row[7].strip().replace('"', '') if len(row) > 7 else ""
            is_law6 = val6.upper().startswith("ART.")
            is_law7 = val7.upper().startswith("ART.")

            if is_law7 and not is_law6:
                # 2022 order: col6=location, col7=law
                amparolegal = val7
                localcometimento = val6
            elif is_law6 and not is_law7:
                # Standard order: col6=law, col7=location
                amparolegal = val6
                localcometimento = val7
            elif is_law6 and is_law7:
                # Both look like law (rare) — use standard order
                amparolegal = val6
                localcometimento = val7
            else:
                # Neither looks like law (rare) — use standard order
                amparolegal = val6
                localcometimento = val7

            date_norm = normalize_date(datainfracao)
            time_norm = normalize_time(horainfracao)
            agent_id = lookup_agent(agenteequipamento)
            infracao_id = lookup_infracao(infracao, amparolegal, descricaoinfracao)
            location_id = lookup_location(localcometimento, year)

            if agent_id < 0:
                unknown_agents.add(agenteequipamento[:60])
                skipped += 1
                continue
            if infracao_id < 0:
                unknown_infr.add(f"{infracao[:20]}|{amparolegal[:40]}")
                skipped += 1
                continue

            if writer:
                writer.writerow([date_norm, time_norm, str(agent_id), str(infracao_id), str(location_id)])
            rows += 1

    for a in list(unknown_agents)[:5]:
        print(f"  WARNING: unknown agent: {a}")
    if len(unknown_agents) > 5:
        print(f"  ... and {len(unknown_agents) - 5} more unknown agents")
    if unknown_infr:
        print(f"  WARNING: {len(unknown_infr)} unknown infraction combos")
        for u in list(unknown_infr)[:3]:
            print(f"    {u[:100]}")

    return rows, skipped

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("ETL: Normalizing v3 semicolon CSV files")
    print(f"  Existing locations: {len(locais_map)}")
    print(f"  Existing agents:    {len(agentes_map)}")
    print(f"  Existing infractions: {len(infracoes_map)}")
    print(f"  Next location ID:    {next_location_id}")
    print()

    totals = {}
    total_rows = 0

    if APPLY:
        out_f = open(OUT_TSV, "w", newline="", encoding="utf-8")
        writer = csv.writer(out_f, delimiter="\t", lineterminator="\n")
     # Write header
        writer.writerow(["datainfracao", "horainfracao", "agente_id", "infracao_id", "local_id"])
    else:
        writer = None

    for year, filepath in sorted(V3_FILES.items()):
        if not os.path.exists(filepath):
            print(f"  {year}: FILE NOT FOUND: {filepath}")
            continue

        print(f"  {year}: reading {os.path.basename(filepath)}...")
        rows, skipped = process_file(filepath, year, writer)
        totals[year] = rows
        total_rows += rows
        print(f"         {rows:,} rows written, {skipped} skipped")

    if APPLY and writer:
        out_f.close()

    # Print summary
    print()
    print(f"Total rows written: {total_rows:,}")
    print(f"New locations discovered: {len(new_locations)}")
    print()

    # Write extended location dictionary
    full_dict = dict(locais_map)
    for desc, lid in new_locations.items():
        full_dict[desc] = lid

    if APPLY:
        with open(OUT_DICT, "w", encoding="utf-8") as f:
            json.dump(full_dict, f, ensure_ascii=False)
        print(f"Extended dict written: {OUT_DICT}")
        print(f"  ({len(full_dict):,} total entries)")

        # Generate SQL to populate traffic_locations
        with open(OUT_SQL, "w", encoding="utf-8") as f:
            f.write("-- Seed traffic_locations from extended dictionary\n")
            f.write("-- Run AFTER migration 0000_add_traffic_locations_equipment.sql\n\n")
            f.write("TRUNCATE traffic_locations RESTART IDENTITY CASCADE;\n\n")

            # Batch into INSERT statements
            batch_size = 5000
            entries = sorted(full_dict.items(), key=lambda x: int(x[1]))
            for i in range(0, len(entries), batch_size):
                batch = entries[i:i + batch_size]
                values = []
                for desc, lid in batch:
                    is_new = "true" if str(lid) in {str(v) for v in new_locations.values()} else "false"
                    safe_desc = desc.replace("'", "''")
                    values.append(f"({lid}, '{safe_desc}', {is_new})")
                f.write(f"INSERT INTO traffic_locations (location_id, raw_description, is_new)\n")
                f.write(f"VALUES {', '.join(values)};\n\n")

            f.write(f"-- Total: {len(full_dict):,} locations ({len(new_locations)} new)\n")
        print(f"SQL seed written: {OUT_SQL}")
    else:
        print("[DRY-RUN] No files written. Use --apply to generate output.")

    print()
    print("=" * 60)
    print("Done.")

if __name__ == "__main__":
    main()
