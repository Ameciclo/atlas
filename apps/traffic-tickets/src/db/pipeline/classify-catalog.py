#!/usr/bin/env python3
"""
Classify traffic_violations_catalog.csv using CTB reference table + keyword rules.
Port of seed-violation-categories.ts classification logic.

Usage: python3 classify-catalog.py [--apply]
"""

import csv
import os
import re
import sys
from collections import defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(DIR)))))
DATA_DIR = os.path.join(ROOT, "packages", "database", "seed-data", "traffic-tickets")
CTB_CSV = os.path.join(DATA_DIR, "auxiliary", "tabela_infracoes_ctb_classificada_pedestres_ciclistas_separados.csv")
CATALOG_CSV = os.path.join(DATA_DIR, "traffic_violations_catalog.csv")
OUT_CSV = os.path.join(DATA_DIR, "traffic_violations_catalog_classified.csv")

APPLY = "--apply" in sys.argv

# ---------------------------------------------------------------------------
# Law normalization (ported from seed-violation-categories.ts)
# ---------------------------------------------------------------------------

def normalize_law(law: str) -> str:
    l = law.lower()
    l = re.sub(r",\s*", " ", l)
    l = re.sub(r"\s+", " ", l)
    # "nico" -> "único" only if not preceded by ú/§
    l = re.sub(r"(?<![ú§])nico", "único", l)
    l = re.sub(r"§\s*único", "parágrafo único", l)
    l = re.sub(r"pargrafo", "parágrafo", l)
    l = re.sub(r"alnea", "alínea", l)
    l = re.sub(r"alínea\s+\w", "", l)
    l = re.sub(r"\s+c/c\s+.*$", "", l)
    # Fix missing space: "Art.168" -> "Art. 168"
    l = re.sub(r"art\.(\d)", r"art. \1", l)
    # "inciso" -> "inc."
    l = re.sub(r"\binciso\b", "inc.", l)
    # Standalone "1" or "§1º" -> "parágrafo 1"
    l = re.sub(r",?\s*§?\s*1\s*$", " parágrafo 1", l)
    l = re.sub(r",?\s*§\s*1[º°]\s*,?", " parágrafo 1 ", l)
    l = re.sub(r",?\s*§\s*2[º°]\s*,?", " parágrafo 2 ", l)
    l = re.sub(r",?\s*§\s*3[º°]\s*,?", " parágrafo 3 ", l)
    # Remove "do CTB" suffix
    l = re.sub(r"\s*do\s+ctb\.?\s*$", "", l)
    # Remove trailing "ambos do CTB" from cross-refs
    l = re.sub(r",?\s*ambos\s+do\s+ctb\.?\s*$", "", l)
    # Remove decree references
    l = re.sub(r"\s*\(dec\..*$", "", l)
    l = re.sub(r"\s*dec\..*$", "", l)
    # Fix "Inc. Inc" -> "Inc."
    l = re.sub(r"\binc\.\s+inc\.?\b", "inc.", l)
    # Fix "I, c" -> "I, alínea c" (single letter after comma)
    l = re.sub(r",\s+([a-z])\s*$", r", alínea \1", l)
    l = re.sub(r",\s+([a-z])\s*,", r", alínea \1,", l)
    # Collapse multiple spaces
    l = re.sub(r"\s+", " ", l)
    return l.strip()


# Manual overrides (same as seed-violation-categories.ts)
MANUAL_MAPPINGS = {
    "7064": "Segurança viária",
    "6416": "Administrativas/documentais",
    "6920": "Administrativas/documentais",
    "7242": "Segurança viária",
    "7277": "Segurança viária",
    "7722": "Segurança viária",
    "7110": "Ciclistas",
    "7137": "Ciclistas",
    "7633": "Segurança viária",
    "7765": "Segurança viária",
    "7670": "Ciclistas",
    "7684": "Segurança viária",
    "7714": "Segurança viária",
}

# ---------------------------------------------------------------------------
# Keyword rules for sub-classification (same as seed-violation-categories.ts)
# ---------------------------------------------------------------------------

KEYWORD_RULES = [
    # Art. 181 Inc. VIII (code 5452)
    ("5452", "passeio", "Pedestres"),
    ("5452", "pedestre", "Pedestres"),
    ("5452", "ciclovia", "Ciclistas"),
    ("5452", "ciclofaixa", "Ciclistas"),
    ("5452", "gramados", "Estacionamento/uso da via"),
    ("5452", "jardim", "Estacionamento/uso da via"),
    ("5452", "canteiros", "Estacionamento/uso da via"),
    ("5452", "ilhas", "Estacionamento/uso da via"),
    ("5452", "refúgios", "Estacionamento/uso da via"),
    ("5452", "marcas de canalização", "Estacionamento/uso da via"),
    # Art. 193 (code 5819)
    ("5819", "calçadas", "Pedestres"),
    ("5819", "passeios", "Pedestres"),
    ("5819", "passarelas", "Pedestres"),
    ("5819", "ciclovias", "Ciclistas"),
    ("5819", "ciclofaixas", "Ciclistas"),
    ("5819", "acostamentos", "Segurança viária"),
    # Art. 182 Inc. VI (code 5622)
    ("5622", "passeio", "Pedestres"),
    ("5622", "pedestres", "Pedestres"),
    # Art. 214 Inc. I (code 6122)
    ("6122", "pedestre", "Pedestres"),
    ("6122", "não motorizado", "Ciclistas"),
    # Art. 206 Inc. III (codes 6017, 6025)
    ("6017", "calçada", "Pedestres"),
    ("6017", "passeio", "Pedestres"),
    ("6017", "faixas de pedestres", "Pedestres"),
    ("6017", "não motorizados", "Ciclistas"),
]

# ---------------------------------------------------------------------------
# Build code -> default category from CTB CSV
# ---------------------------------------------------------------------------

def load_ctb_classification():
    """Return dict: normalized_base_legal -> set of categories."""
    ctb = defaultdict(set)
    with open(CTB_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            base = row.get("base_legal", "").strip()
            cat = row.get("classificacao", "").strip()
            if base and cat:
                norm = normalize_law(base)
                ctb[norm].add(cat)
    return ctb


# ---------------------------------------------------------------------------
# Build (cttu_code, law_code) lookup from raw data
# ---------------------------------------------------------------------------

def build_code_law_lookup():
    """Map cttu_code -> law_code by reading all 19 raw files."""
    code_to_law = {}
    infra_dir = os.path.join(DATA_DIR, "source-data")
    tsv_years = {"2007", "2008", "2009", "2010", "2011", "2012", "2025"}

    for year in sorted(tsv_years | {str(y) for y in range(2013, 2025)}):
        fpath = os.path.join(infra_dir, f"{year}.tsv")
        if not os.path.exists(fpath):
            continue
        is_tsv = year in tsv_years
        with open(fpath, "r", encoding="utf-8-sig") as f:
            if is_tsv:
                reader = csv.reader(f, delimiter="\t")
                next(reader)
                for row in reader:
                    if len(row) < 9:
                        continue
                    code = row[5].strip().replace(",0", "").replace(",", "")
                    law = row[7].strip()
                    if law.upper().startswith("ART.") and code:
                        code_to_law[code] = law
            else:
                reader = csv.reader(f, delimiter=";")
                next(reader)
                for row in reader:
                    if len(row) < 7:
                        continue
                    code = row[4].strip().replace('"', '').replace(",0", "").replace(",", "")
                    val6 = row[6].strip().replace('"', '') if len(row) > 6 else ''
                    val7 = row[7].strip().replace('"', '') if len(row) > 7 else ''
                    is_l6 = val6.upper().startswith("ART.")
                    is_l7 = val7.upper().startswith("ART.")
                    law = val7 if (is_l7 and not is_l6) else val6
                    if law.upper().startswith("ART.") and code and code not in code_to_law:
                        code_to_law[code] = law
    return code_to_law


# ---------------------------------------------------------------------------
# Main classification logic
# ---------------------------------------------------------------------------

def classify():
    ctb = load_ctb_classification()
    code_to_law = build_code_law_lookup()
    print(f"CTB classifications: {len(ctb)} normalized laws")
    print(f"Code -> Law mapping: {len(code_to_law)} codes")

    # Build keyword lookup: code -> [(keyword, category)]
    kw_by_code = defaultdict(list)
    for code, kw, cat in KEYWORD_RULES:
        kw_by_code[code].append((kw, cat))

    # Load catalog
    rows = []
    with open(CATALOG_CSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    print(f"Catalog rows: {len(rows)}")

    unmatched = 0
    classified = []

    for row in rows:
        law = row["law_code"].strip()
        desc = row["canonical_description"].strip().lower()
        norm_law = normalize_law(law)

        # Strategy 1: Match law via CTB table
        categories = ctb.get(norm_law, set())

        # Strategy 2: Find the cttu_code that maps to this law
        cttu_code = None
        for code, l in code_to_law.items():
            if normalize_law(l) == norm_law:
                cttu_code = code
                break

        # Strategy 3: Try manual mapping
        manual_cat = None
        if cttu_code and cttu_code in MANUAL_MAPPINGS:
            manual_cat = MANUAL_MAPPINGS[cttu_code]
            categories.add(manual_cat)

        if not categories and not manual_cat:
            unmatched += 1
            if unmatched <= 20:
                print(f"  UNMATCHED: {law[:80]}")

        # Determine final category
        final_cat = ""

        if cttu_code and cttu_code in kw_by_code:
            # Check keyword rules: which keyword matches the description?
            for kw, cat in kw_by_code[cttu_code]:
                if kw in desc:
                    final_cat = cat
                    break
            # If no keyword matched, use default category from CTB
            if not final_cat and categories:
                final_cat = next(iter(categories))
        elif categories:
            final_cat = next(iter(categories))
        else:
            final_cat = ""

        classified.append({
            "law_code": law,
            "canonical_description": row["canonical_description"],
            "category": final_cat,
            "total_rows": row.get("total_rows", ""),
        })

    print(f"  Total rows: {len(classified)}")
    print(f"  Unmatched:  {unmatched}")
    print(f"  Classified: {sum(1 for r in classified if r['category'])}")

    # Category distribution
    dist = defaultdict(int)
    for r in classified:
        if r["category"]:
            dist[r["category"]] += 1
    print("\nCategories:")
    for cat, cnt in sorted(dist.items(), key=lambda x: -x[1]):
        print(f"  {cat}: {cnt}")

    return classified


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Classifying Infraction Catalog")
    print()

    result = classify()

    if not APPLY:
        print("\n[DRY-RUN] Use --apply to write classified catalog.")
        return

    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["law_code", "canonical_description", "category", "total_rows"])
        for r in result:
            writer.writerow([r["law_code"], r["canonical_description"], r["category"], r.get("total_rows", "")])

    print(f"\nClassified catalog written: {OUT_CSV}")


if __name__ == "__main__":
    main()
