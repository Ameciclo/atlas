#!/usr/bin/env python3
"""
Build the infraction_catalog by:
1. Auto-detecting and fixing encoding-broken descriptions (accent variants)
2. Replacing truncated descriptions with their longest variant
3. Producing infraction_catalog.csv ready for classification

Usage: python3 build-infraction-catalog.py [--apply]
  --apply   Write output files (otherwise dry-run)
"""

import csv
import json
import os
import re
import sys
import unicodedata

DIR = os.path.dirname(os.path.abspath(__file__))
INFRA_DIR = os.path.join(DIR, "all-infracoes")
CORRECTIONS_CSV = os.path.join(DIR, "descricoes_infracoes_corrigidas.csv")
OUT_CORRECTIONS = os.path.join(DIR, "descricoes_infracoes_corrigidas_expanded.csv")
OUT_CATALOG = os.path.join(DIR, "infraction_catalog.csv")
OUT_MAPPING = os.path.join(DIR, "descricao_mapping.csv")

APPLY = "--apply" in sys.argv

# ---------------------------------------------------------------------------
# Load existing corrections
# ---------------------------------------------------------------------------

def load_corrections():
    corrections = {}
    if not os.path.exists(CORRECTIONS_CSV):
        return corrections
    with open(CORRECTIONS_CSV, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            if len(row) >= 4:
                orig = row[2].strip().replace('"', '')
                corr = row[3].strip().replace('"', '')
                if orig and corr and orig != corr:
                    corrections[orig] = corr
    return corrections

def strip_accents(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("utf-8")

# ---------------------------------------------------------------------------
# Extract all (law, description) pairs from raw files
# ---------------------------------------------------------------------------

def extract_all_pairs(corrections):
    """Return dict: law -> set of (description, row_count) tuples."""
    from collections import defaultdict, Counter

    tsv_years = {"2007", "2008", "2009", "2010", "2011", "2012", "2025"}
    pairs = defaultdict(Counter)  # law -> Counter(description -> count)

    for year in sorted(tsv_years | {str(y) for y in range(2013, 2025)}):
        fpath = os.path.join(INFRA_DIR, f"{year}.tsv")
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
                    law = row[7].strip()
                    desc = row[6].strip()
                    if law.upper().startswith("ART."):
                        desc = corrections.get(desc, desc)
                        pairs[law][desc] += 1
            else:
                reader = csv.reader(f, delimiter=";")
                next(reader)
                for row in reader:
                    if len(row) < 7:
                        continue
                    desc = row[5].strip().replace('"', '')
                    val6 = row[6].strip().replace('"', '') if len(row) > 6 else ''
                    val7 = row[7].strip().replace('"', '') if len(row) > 7 else ''
                    is_l6 = val6.upper().startswith("ART.")
                    is_l7 = val7.upper().startswith("ART.")
                    law = val7 if (is_l7 and not is_l6) else val6
                    if law.upper().startswith("ART."):
                        desc = corrections.get(desc, desc)
                        pairs[law][desc] += 1

    return pairs

# ---------------------------------------------------------------------------
# Step 1: Auto-detect encoding variants via trigram similarity
# ---------------------------------------------------------------------------

def trigram_similarity(a: str, b: str) -> float:
    """Jaccard similarity of character trigrams."""
    def get_trigrams(s):
        padded = f"  {s} "
        return {padded[i:i+3] for i in range(len(padded) - 2)}
    ta = get_trigrams(a.lower())
    tb = get_trigrams(b.lower())
    if not ta and not tb:
        return 1.0
    return len(ta & tb) / len(ta | tb)


def has_accents(s: str) -> bool:
    return any(ord(c) > 127 for c in s)


def detect_encoding_variants(pairs):
    """For each law, cluster descriptions by trigram similarity.
    Within each cluster, the best-accented version wins.
    Broken/encoding-corrupted variants get mapped to the canonical one.
    """
    new_corrections = {}

    for law, desc_counts in pairs.items():
        descs = list(desc_counts.keys())
        if len(descs) < 2:
            continue

        # Build similarity matrix and cluster
        clusters = []  # list of sets of indices
        assigned = set()

        for i in range(len(descs)):
            if i in assigned:
                continue
            cluster = {i}
            for j in range(i + 1, len(descs)):
                if j in assigned:
                    continue
                sim = trigram_similarity(descs[i], descs[j])
                if sim > 0.72:  # high similarity = encoding variant
                    cluster.add(j)
                    assigned.add(j)
            assigned.add(i)
            clusters.append(cluster)

        # For each cluster with >1 member, pick canonical
        for cluster in clusters:
            if len(cluster) < 2:
                continue
            members = [(idx, descs[idx], desc_counts[descs[idx]]) for idx in cluster]

            # Only merge if at least one has accents (accented vs broken)
            accented = [(idx, d, c) for idx, d, c in members if has_accents(d)]
            if not accented:
                continue

            # Pick best: prefer accented, then longest, then highest count
            best_idx, best_desc, _ = max(members, key=lambda x: (
                has_accents(x[1]),
                len(x[1]),
                x[2],
            ))

            for idx, desc, cnt in members:
                if desc != best_desc:
                    new_corrections[desc] = best_desc

    return new_corrections

# ---------------------------------------------------------------------------
# Step 2: Handle truncation
# ---------------------------------------------------------------------------

def detect_truncations(pairs):
    """For each law, find descriptions that are prefixes of a longer description.
    Returns: dict truncated_desc -> full_desc
    """
    trunc_fixes = {}

    for law, desc_counts in pairs.items():
        descs = sorted(desc_counts.keys(), key=len, reverse=True)

        for i, long_desc in enumerate(descs):
            for short_desc in descs[i + 1:]:
                if len(short_desc) < 20:  # too short to be meaningful
                    continue
                # Check if short is a prefix of long (allowing for mid-word cut)
                if long_desc.startswith(short_desc):
                    # Only fix if the longer version has more content
                    extra = long_desc[len(short_desc):].strip()
                    if len(extra) > 3:  # at least 3 chars of new content
                        trunc_fixes[short_desc] = long_desc

    return trunc_fixes

# ---------------------------------------------------------------------------
# Step 3: Build canonical catalog
# ---------------------------------------------------------------------------

def build_catalog(pairs, encoding_fixes, trunc_fixes):
    """After applying all corrections, produce canonical (law, description) pairs."""
    from collections import Counter

    catalog = {}  # (law, canonical_desc) -> total_rows

    for law, desc_counts in pairs.items():
        for desc, cnt in desc_counts.items():
            canonical = desc
            # Apply encoding fix
            if canonical in encoding_fixes:
                canonical = encoding_fixes[canonical]
            # Apply truncation fix
            if canonical in trunc_fixes:
                canonical = trunc_fixes[canonical]
            key = (law, canonical)
            catalog[key] = catalog.get(key, 0) + cnt

    return catalog

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("Building Infraction Catalog")
    print()

    # Load existing corrections
    existing = load_corrections()
    print(f"Existing manual corrections: {len(existing)}")

    # Extract all pairs
    print("Extracting all (law, description) pairs from 19 files...")
    pairs = extract_all_pairs(existing)
    total_laws = len(pairs)
    total_variants = sum(len(ds) for ds in pairs.values())
    print(f"  {total_laws} laws, {total_variants} description variants")
    print()

    # Step 1: Auto-detect encoding variants
    print("Step 1: Auto-detecting encoding variants...")
    encoding_fixes = detect_encoding_variants(pairs)
    print(f"  Found {len(encoding_fixes)} encoding corrections")
    # Merge existing + new
    all_fixes = dict(existing)
    all_fixes.update(encoding_fixes)
    print()

    # Re-extract with ALL corrections applied
    print("Re-extracting with all encoding corrections applied...")
    pairs = extract_all_pairs(all_fixes)
    total_variants = sum(len(ds) for ds in pairs.values())
    print(f"  Now: {total_variants} description variants (encoding collapsed)")
    print()

    # Step 2: Handle truncation
    print("Step 2: Detecting truncations...")
    trunc_fixes = detect_truncations(pairs)
    print(f"  Found {len(trunc_fixes)} truncation fixes")
    if trunc_fixes:
        for short, long in list(trunc_fixes.items())[:5]:
            print(f"    \"{short[:80]}...\" -> \"{long[:80]}...\"")
    print()

    # Step 3: Build canonical catalog
    print("Step 3: Building canonical catalog...")
    catalog = build_catalog(pairs, encoding_fixes, trunc_fixes)
    print(f"  Canonical rows: {len(catalog)}")

    # Show distribution
    from collections import defaultdict, Counter
    law_groups = defaultdict(list)
    for (law, desc), cnt in catalog.items():
        law_groups[law].append((desc, cnt))

    laws_with_multi = [(law, items) for law, items in law_groups.items() if len(items) > 1]
    laws_with_multi.sort(key=lambda x: -len(x[1]))

    print(f"  Laws with >1 description (specificity preserved): {len(laws_with_multi)}")
    print()

    # Write outputs
    if not APPLY:
        print("[DRY-RUN] Use --apply to write files.")
        print()
        print("Summary of catalog:")
        for law, items in laws_with_multi[:5]:
            total = sum(c for _, c in items)
            print(f"  {law} ({len(items)} descs, {total:,} rows):")
            for desc, cnt in items:
                print(f"    [{cnt:>10,}] {desc[:110]}")
        return

    # Write expanded corrections CSV
    all_corrections = dict(existing)
    all_corrections.update(encoding_fixes)

    with open(OUT_CORRECTIONS, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["violation_code", "law_code", "description", "description_corrected"])
        for orig, corr in sorted(all_corrections.items()):
            writer.writerow(["", "", orig, corr])
    print(f"Expanded corrections written: {OUT_CORRECTIONS}")
    print(f"  ({len(all_corrections)} total corrections: {len(existing)} existing + {len(encoding_fixes)} new)")

    # Build mapping: every raw description → canonical description
    print("Building description mapping (raw → canonical)...")
    raw_pairs = extract_all_pairs({})  # extract without any corrections
    mapping = {}  # raw_desc → canonical_desc
    for law, desc_counts in raw_pairs.items():
        for raw_desc, cnt in desc_counts.items():
            canonical = raw_desc
            if canonical in all_corrections:
                canonical = all_corrections[canonical]
            if canonical in trunc_fixes:
                canonical = trunc_fixes[canonical]
            mapping[raw_desc] = (canonical, cnt)

    with open(OUT_MAPPING, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["raw_description", "canonical_description", "frequency"])
        for raw, (canonical, cnt) in sorted(mapping.items()):
            writer.writerow([raw, canonical, cnt])
    print(f"Description mapping written: {OUT_MAPPING}")
    print(f"  ({len(mapping)} raw descriptions → {len(set(v for v,_ in mapping.values()))} canonical)")

    # Write canonical catalog CSV
    with open(OUT_CATALOG, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["law_code", "canonical_description", "category", "total_rows"])
        for (law, desc), cnt in sorted(catalog.items()):
            writer.writerow([law, desc, "", cnt])
    print(f"Catalog written: {OUT_CATALOG}")
    print(f"  ({len(catalog)} rows, category column empty — needs classification)")

    print()
    print("=" * 60)
    print("Done. Next step: classify infraction_catalog.csv")


if __name__ == "__main__":
    main()
