#!/usr/bin/env python3
"""
ETL v3: Normalize 19 raw files → infracoes_reduzido_v3.tsv (7 columns).
Handles 2 formats (Datastore TSV 2007-2012+2025, semicolon CSV 2013-2024).

Output columns (TSV, tab-separated, UTF-8):
  violation_date  agent_id  violation_code  law_code  description  location_id  location_description

Usage: python3 etl-normalize.py [--apply]
"""

import csv
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime

DIR = os.path.dirname(os.path.abspath(__file__))
INFRA_DIR = os.path.join(DIR, "all-infracoes")
DICT_LOCAIS = os.path.join(DIR, "dict_locais_v3.json")
CORRECTIONS_CSV = os.path.join(DIR, "descricoes_infracoes_corrigidas_expanded.csv")
OUT_TSV = os.path.join(DIR, "infracoes_reduzido_v3.tsv")

APPLY = "--apply" in sys.argv

# ===========================================================================
# Load reference data
# ===========================================================================

def load_location_dict():
    """Load dict_locais_v3.json → mapping raw_string to location_id."""
    with open(DICT_LOCAIS, "r", encoding="utf-8") as f:
        enriched = json.load(f)
    # Build simple string→id mapping
    return {key: enriched[key]["id"] for key in enriched}

def load_corrections():
    """Load encoding corrections → mapping broken_desc to corrected_desc."""
    corrections = {}
    with open(CORRECTIONS_CSV, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        next(reader)  # skip header
        for row in reader:
            if len(row) >= 4:
                orig = row[2].strip().replace('"', '')
                corr = row[3].strip().replace('"', '')
                if orig and corr and orig != corr:
                    corrections[orig] = corr
    return corrections

# ===========================================================================
# File definitions
# ===========================================================================

# TSV files: tab-separated, header with _id, columns in order
TSV_FILES = {
    "2007": os.path.join(INFRA_DIR, "2007.tsv"),
    "2008": os.path.join(INFRA_DIR, "2008.tsv"),
    "2009": os.path.join(INFRA_DIR, "2009.tsv"),
    "2010": os.path.join(INFRA_DIR, "2010.tsv"),
    "2011": os.path.join(INFRA_DIR, "2011.tsv"),
    "2012": os.path.join(INFRA_DIR, "2012.tsv"),
    "2025": os.path.join(INFRA_DIR, "2025.tsv"),
}

CSV_FILES = {
    str(y): os.path.join(INFRA_DIR, f"{y}.tsv")
    for y in range(2013, 2025)
}

# ===========================================================================
# Date/Time parsing
# ===========================================================================

def parse_violation_date(date_str, time_str):
    """Parse date and time into YYYY-MM-DD HH:MM:SS or None.
    
    Handles 4 date formats:
    - YYYY-MM-DD (TSV 2007-2012,2025; CSV 2013-2014,2016-2023)
    - YYYY/MM/DD (CSV 2015)
    - DD/MM/YYYY (CSV 2024)
    
    Time always comes from the separate horainfracao column.
    The date column may include a time component (always 00:00 for 2015/2024) — ignored.
    """
    date_str = (date_str or "").strip()
    time_str = (time_str or "").strip()
    
    if not date_str:
        return None
    
    # Parse date (only the date part, ignoring any trailing time component)
    parsed_date = None
    
    # Format: YYYY-MM-DD
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", date_str)
    if m:
        parsed_date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    
    # Format: DD/MM/YYYY
    if not parsed_date:
        m = re.match(r"(\d{2})/(\d{2})/(\d{4})", date_str)
        if m:
            parsed_date = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    
    # Format: YYYY/MM/DD
    if not parsed_date:
        m = re.match(r"(\d{4})/(\d{2})/(\d{2})", date_str)
        if m:
            parsed_date = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    
    if not parsed_date:
        return None
    
    # Parse time from the separate horainfracao column
    parsed_time = "00:00:00"
    if time_str:
        tm = re.search(r"(\d{1,2}):(\d{2})(?::(\d{2}))?", time_str)
        if tm:
            h, m, s = int(tm.group(1)), tm.group(2), tm.group(3) or "00"
            parsed_time = f"{h:02d}:{m}:{s}"
    
    return f"{parsed_date} {parsed_time}"

# ===========================================================================
# Agent extraction
# ===========================================================================

def extract_agent_id(raw):
    """Extract agent number (1-9) from agenteequipamento text. Returns 0 for NA."""
    if not raw or not raw.strip():
        return 0
    
    raw = raw.strip()
    
    # Corruption markers
    if raw == "Agente/Equipamento":
        return -1  # header leaked, discard
    if re.match(r'^\d{5,}$', raw):
        return -1  # corrupted row
    
    # Extract first digit 1-9
    nums = re.findall(r'\d+', raw)
    for n in nums:
        ni = int(n)
        if 1 <= ni <= 9:
            return ni
    
    return 0  # NA

# ===========================================================================
# Row parsing per format
# ===========================================================================

def parse_tsv_row(row):
    """Parse a TSV row (2007-2012, 2025).
    Returns dict with extracted fields or None if invalid.
    """
    if len(row) < 9:
        return None
    
    date_str = row[1].strip() if len(row) > 1 else ""
    time_str = row[2].strip() if len(row) > 2 else ""
    agent_raw = row[4].strip() if len(row) > 4 else ""
    code = row[5].strip() if len(row) > 5 else ""
    desc = row[6].strip() if len(row) > 6 else ""
    law = row[7].strip() if len(row) > 7 else ""
    loc = row[8].strip() if len(row) > 8 else ""
    
    return _process_fields(date_str, time_str, agent_raw, code, desc, law, loc)

def parse_csv_row(row, year):
    """Parse a semicolon CSV row (2013-2024).
    Handles column swap detection for 2022.
    """
    if len(row) < 7:
        return None
    
    # Clean quoted fields
    fields = [f.strip().replace('"', '') for f in row]
    while len(fields) < 8:
        fields.append("")
    
    date_str = fields[0]
    time_str = fields[1] if len(fields) > 1 else ""
    agent_raw = fields[3] if len(fields) > 3 else ""
    code = fields[4] if len(fields) > 4 else ""
    desc = fields[5] if len(fields) > 5 else ""
    val6 = fields[6] if len(fields) > 6 else ""
    val7 = fields[7] if len(fields) > 7 else ""
    
    # Detect column swap (2022 has location before law)
    is_law6 = val6.upper().startswith("ART.")
    is_law7 = val7.upper().startswith("ART.")
    
    if is_law7 and not is_law6:
        law = val7
        loc = val6
    elif is_law6 and not is_law7:
        law = val6
        loc = val7
    elif is_law6 and is_law7:
        law = val6
        loc = val7
    else:
        law = val6
        loc = val7
    
    return _process_fields(date_str, time_str, agent_raw, code, desc, law, loc)

def _process_fields(date_str, time_str, agent_raw, code, desc, law, loc):
    """Common field processing for both formats."""
    
    # Clean violation_code
    code = code.replace(",0", "").replace(",", "").strip()
    if not code or not code.isdigit():
        return None
    
    # Validate amparolegal
    law = law.strip()
    if not law.upper().startswith("ART."):
        return None
    law = law.replace(",0", "").strip()
    
    # Parse date
    violation_date = parse_violation_date(date_str, time_str)
    if not violation_date:
        return None
    
    # Extract agent_id
    agent_id = extract_agent_id(agent_raw)
    if agent_id < 0:
        return None  # corrupted row, discard
    
    # Clean description
    desc = desc.strip()
    
    # Clean location
    loc = loc.strip()
    
    return {
        "violation_date": violation_date,
        "agent_id": agent_id,
        "violation_code": code,
        "law_code": law,
        "description": desc,
        "location_raw": loc,
    }

# ===========================================================================
# Main processing
# ===========================================================================

def main():
    print("=" * 60)
    print("ETL v3: Normalizing 19 files → infracoes_reduzido_v3.tsv")
    print()
    
    # Load references
    print("Loading reference data...")
    loc_dict = load_location_dict()
    corrections = load_corrections()
    print(f"  Location dict: {len(loc_dict):,} entries")
    print(f"  Corrections:   {len(corrections):,} pairs")
    print()
    
    # Process files
    totals = {}
    total_rows = 0
    total_skipped = Counter()
    
    writer = None
    out_f = None
    if APPLY:
        out_f = open(OUT_TSV, "w", newline="", encoding="utf-8")
        writer = csv.writer(out_f, delimiter="\t", lineterminator="\n")
        writer.writerow([
            "violation_date", "agent_id", "violation_code",
            "law_code", "description", "location_id", "location_description"
        ])
    
    # Process TSV files
    for year in sorted(TSV_FILES.keys()):
        fpath = TSV_FILES[year]
        if not os.path.exists(fpath):
            print(f"  {year}: FILE NOT FOUND: {fpath}")
            continue
        
        rows = 0
        skipped = Counter()
        print(f"  {year} (TSV): reading...", end=" ", flush=True)
        
        with open(fpath, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f, delimiter="\t")
            next(reader)  # skip header
            for row in reader:
                parsed = parse_tsv_row(row)
                if not parsed:
                    skipped["invalid_row"] += 1
                    continue
                
                # Apply encoding correction to description
                desc = corrections.get(parsed["description"], parsed["description"])
                
                # Lookup location_id
                loc_raw = parsed["location_raw"]
                loc_id = loc_dict.get(loc_raw)
                if loc_id is None:
                    skipped["unknown_location"] += 1
                    continue
                
                if writer:
                    writer.writerow([
                        parsed["violation_date"],
                        parsed["agent_id"],
                        parsed["violation_code"],
                        parsed["law_code"],
                        desc,
                        loc_id,
                        loc_raw,
                    ])
                rows += 1
        
        totals[year] = rows
        total_rows += rows
        for k, v in skipped.items():
            total_skipped[k] += v
        print(f"{rows:,} rows, {sum(skipped.values())} skipped")
    
    # Process CSV files
    for year in sorted(CSV_FILES.keys()):
        fpath = CSV_FILES[year]
        if not os.path.exists(fpath):
            print(f"  {year}: FILE NOT FOUND: {fpath}")
            continue
        
        rows = 0
        skipped = Counter()
        print(f"  {year} (CSV): reading...", end=" ", flush=True)
        
        with open(fpath, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f, delimiter=";")
            next(reader)  # skip header
            for row in reader:
                parsed = parse_csv_row(row, year)
                if not parsed:
                    skipped["invalid_row"] += 1
                    continue
                
                # Apply encoding correction to description
                desc = corrections.get(parsed["description"], parsed["description"])
                
                # Lookup location_id
                loc_raw = parsed["location_raw"]
                loc_id = loc_dict.get(loc_raw)
                if loc_id is None:
                    skipped["unknown_location"] += 1
                    continue
                
                if writer:
                    writer.writerow([
                        parsed["violation_date"],
                        parsed["agent_id"],
                        parsed["violation_code"],
                        parsed["law_code"],
                        desc,
                        loc_id,
                        loc_raw,
                    ])
                rows += 1
        
        totals[year] = rows
        total_rows += rows
        for k, v in skipped.items():
            total_skipped[k] += v
        print(f"{rows:,} rows, {sum(skipped.values())} skipped")
    
    if APPLY and out_f:
        out_f.close()
    
    # Summary
    print()
    print(f"Total rows written: {total_rows:,}")
    for k, v in total_skipped.most_common():
        print(f"  Skipped ({k}): {v:,}")
    print()
    
    if not APPLY:
        print("[DRY-RUN] Use --apply to write output.")
    else:
        size_mb = os.path.getsize(OUT_TSV) / (1024 * 1024)
        print(f"Output: {OUT_TSV} ({size_mb:.1f} MB)")
    
    print()
    print("=" * 60)
    print("Done.")

if __name__ == "__main__":
    main()
