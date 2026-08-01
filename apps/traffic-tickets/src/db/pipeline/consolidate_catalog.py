#!/usr/bin/env python3
"""Consolidate traffic_violations_catalog.csv by merging near-duplicate descriptions within each cttu_code group."""

import csv
import json
import difflib
import re
import io
import os
from collections import defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(DIR)))))
DATA_DIR = os.path.join(ROOT, "packages", "database", "seed-data", "traffic-tickets")
INPUT_CSV = os.path.join(DATA_DIR, "traffic_violations_catalog.csv")
OUTPUT_CSV = os.path.join(DATA_DIR, "traffic_violations_catalog_consolidated.csv")
CTB_FILE = os.path.join(DATA_DIR, "auxiliary", "ctb.txt")

# --- 1. Load CTB text and extract article-level descriptions ---
def load_ctb_text(filepath):
    """Read ctb.txt and extract the authoritative description for each article."""
    with open(filepath, encoding="utf-8") as f:
        text = f.read()

    # We'll extract key articles that appear in our CSV
    # The ctb.txt has articles like:
    #   Art. 162. Dirigir veículo:
    #   Art. 163. Entregar a direção do veículo a pessoa nas condições previstas no artigo anterior:
    #   Art. 164. Permitir que pessoa nas condições referidas nos incisos do art. 162 tome posse do veículo automotor e passe a conduzi-lo na via:
    # etc.
    ctb_articles = {}
    # Match "Art. NNN. description" patterns (up to the next blank line or next Art.)
    pattern = re.compile(
        r'Art\.\s*(\d+(?:[-\w]*\w)?)\.\s*(.+?)(?:\n\s*\n|\n\s*(?:Art\b|CAP[IÍ]TULO|Infração|Penalidade|Medida|Par[áa]grafo|\§|I+\s*[-–]))',
        re.DOTALL
    )
    for m in pattern.finditer(text):
        art_num = m.group(1).strip()
        desc = m.group(2).strip()
        # Clean up: remove (Redação..., (Incluído..., (Vigência), line continuations
        desc = re.sub(r'\(Redação[^)]*\)', '', desc)
        desc = re.sub(r'\(Inclu[íi]do[^)]*\)', '', desc)
        desc = re.sub(r'\(Vigência\)', '', desc)
        desc = re.sub(r'\(VETADO\)', '', desc)
        desc = ' '.join(desc.split())
        ctb_articles[art_num] = desc

    # Also capture the inciso-level texts for Art. 162
    # They look like: "I - sem possuir Carteira Nacional..."
    # We'll grab them from Art. 162 section
    art_162_match = re.search(
        r'Art\.\s*162\..*?(?=\n\s*\n\s*Art\.\s*163\.)',
        text, re.DOTALL
    )
    if art_162_match:
        section = art_162_match.group(0)
        for inc in re.finditer(
            r'(I{1,3}|I?V|V?I{0,3})\s*[-–]\s*(.+?)(?=\n\s*\n|\n\s*(?:I{1,3}|I?V|V?I{0,3})\s*[-–]|Infração|Penalidade|Medida)',
            section, re.DOTALL
        ):
            inc_label = inc.group(1).strip()
            inc_desc = inc.group(2).strip()
            inc_desc = re.sub(r'\(Redação[^)]*\)', '', inc_desc)
            inc_desc = re.sub(r'\(Inclu[íi]do[^)]*\)', '', inc_desc)
            inc_desc = re.sub(r'\(Vigência\)', '', inc_desc)
            inc_desc = ' '.join(inc_desc.split())
            ctb_articles[f'162-{inc_label}'] = inc_desc

    # Capture art 181 incisos
    art_181_match = re.search(
        r'Art\.\s*181\..*?(?=\n\s*\n\s*Art\.\s*182\.)',
        text, re.DOTALL
    )
    if art_181_match:
        section = art_181_match.group(0)
        for inc in re.finditer(
            r'(I{1,3}|I?V|V?I{0,3}|X{1,3}(?:I[VX])?)\s*[-–]\s*(.+?)(?=\n\s*\n|\n\s*(?:I{1,3}|I?V|V?I{0,3}|X{1,3}(?:I[VX])?)\s*[-–]|Infração|Penalidade|Medida)',
            section, re.DOTALL
        ):
            inc_label = inc.group(1).strip()
            inc_desc = inc.group(2).strip()
            inc_desc = re.sub(r'\(Redação[^)]*\)', '', inc_desc)
            inc_desc = re.sub(r'\(Inclu[íi]do[^)]*\)', '', inc_desc)
            inc_desc = re.sub(r'\(Vigência\)', '', inc_desc)
            inc_desc = ' '.join(inc_desc.split())
            ctb_articles[f'181-{inc_label}'] = inc_desc

    # Capture art 182 incisos
    art_182_match = re.search(
        r'Art\.\s*182\..*?(?=\n\s*\n\s*Art\.\s*183\.)',
        text, re.DOTALL
    )
    if art_182_match:
        section = art_182_match.group(0)
        for inc in re.finditer(
            r'(I{1,3}|I?V|V?I{0,3}|X{1,3}(?:I[VX])?)\s*[-–]\s*(.+?)(?=\n\s*\n|\n\s*(?:I{1,3}|I?V|V?I{0,3}|X{1,3}(?:I[VX])?)\s*[-–]|Infração|Penalidade|Medida)',
            section, re.DOTALL
        ):
            inc_label = inc.group(1).strip()
            inc_desc = inc.group(2).strip()
            inc_desc = re.sub(r'\(Redação[^)]*\)', '', inc_desc)
            inc_desc = re.sub(r'\(Inclu[íi]do[^)]*\)', '', inc_desc)
            inc_desc = re.sub(r'\(Vigência\)', '', inc_desc)
            inc_desc = ' '.join(inc_desc.split())
            ctb_articles[f'182-{inc_label}'] = inc_desc

    return ctb_articles

# --- 2. Parse CSV ---
def parse_csv(filepath):
    rows = []
    with open(filepath, encoding="utf-8") as f:
        # Use csv module to handle quoted JSON arrays
        reader = csv.DictReader(f)
        for row in reader:
            try:
                variants = json.loads(row["known_variants"])
            except (json.JSONDecodeError, KeyError):
                variants = []
            rows.append({
                "id": int(row["id"]),
                "cttu_code": int(row["cttu_code"]),
                "law_code": row.get("law_code", "").strip(),
                "canonical_description": row.get("canonical_description", "").strip(),
                "known_variants": variants if isinstance(variants, list) else [],
                "category": row.get("category", "").strip(),
                "created_at": row.get("created_at", "").strip(),
            })
    return rows

# --- 3. Normalize text for comparison ---
def normalize(text):
    """Lowercase, remove punctuation, collapse whitespace."""
    text = text.lower()
    # remove punctuation except spaces
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# --- 4. Compute similarity ---
def similarity(a, b):
    """Return a similarity score between 0 and 1."""
    na = normalize(a)
    nb = normalize(b)
    if na == nb:
        return 1.0
    # difflib ratio
    ratio = difflib.SequenceMatcher(None, na, nb).ratio()
    return ratio

def one_contains_other(a, b):
    """Check if normalized a is mostly inside b or vice versa."""
    na = normalize(a)
    nb = normalize(b)
    if len(na) == 0 or len(nb) == 0:
        return False
    # If one is substring of the other (after normalization)
    if na in nb or nb in na:
        return True
    # Check word-level overlap
    words_a = set(na.split())
    words_b = set(nb.split())
    if not words_a or not words_b:
        return False
    overlap = len(words_a & words_b) / min(len(words_a), len(words_b))
    return overlap >= 0.85

# --- 5. Determine if two descriptions describe genuinely different situations ---
# Keywords that indicate different targets/objects/locations
DIFFERENTIATOR_WORDS = {
    # Vehicle/service types
    "polícia", "policia", "incêndio", "incendio", "ambulância", "ambulancia",
    "bombeiro", "socorro", "salvamento", "fiscalização", "fiscalizacao",
    "batedores",
    # Location types (for estacionar/parar distinctions)
    "esquinas", "pontes", "viadutos", "túneis", "tuneis", "acostamentos",
    "passeio", "calçada", "calcada", "canteiros", "ilhas", "refúgios", "refugios",
    "ciclovia", "ciclofaixa", "gramados", "jardim", "cruzamento", "contramão", "contramao",
    "fila dupla", "guia", "meio-fio",
    # Document types
    "cnh", "ppd", "carteira nacional", "permissão", "permissao",
    # Conditions
    "cassada", "suspensão", "suspensao", "vencida", "categoria",
    "lentes", "aparelho", "audição", "audicao", "adaptações", "adaptacoes",
    "prótese", "protese",
    # Actions
    "dirigir", "entregar", "permitir", "estacionar", "parar", "ultrapassar",
    "transitar", "deixar",
}

def extract_key_entities(text):
    """Extract differentiating entities from text."""
    norm = normalize(text)
    found = set()
    for word in DIFFERENTIATOR_WORDS:
        if word in norm:
            found.add(word)
    return found

def are_different_situations(a, b):
    """
    Determine if descriptions describe genuinely different situations
    that should be kept separate.
    """
    na = normalize(a)
    nb = normalize(b)

    # If the core action is different (e.g., "dirigir" vs "entregar" vs "permitir")
    action_words = {
        "dirigir": False, "entregar": False, "permitir": False,
        "estacionar": False, "parar": False, "ultrapassar": False,
        "transitar": False, "deixar": False, "conduzir": False,
        "usar": False, "utilizar": False, "atirar": False, "abandonar": False,
        "confiar": False, "disputar": False, "promover": False,
        "participar": False, "seguir": False, "forçar": False, "forcar": False,
        "executar": False, "transportar": False, "portar": False,
        "falsificar": False, "rebocar": False, "recusar": False,
        "retirar": False, "fazer": False, "ter": False,
    }
    first_word_a = na.split()[0] if na.split() else ""
    first_word_b = nb.split()[0] if nb.split() else ""
    if first_word_a != first_word_b and first_word_a in action_words and first_word_b in action_words:
        return True, "different actions"

    # Check if the descriptions specify different specific entities
    ents_a = extract_key_entities(a)
    ents_b = extract_key_entities(b)

    # For location-based infractions (estacionar/parar with different places)
    location_words = {
        "esquinas", "pontes", "viadutos", "túneis", "tuneis", "acostamentos",
        "passeio", "calçada", "calcada", "canteiros", "ilhas", "refúgios", "refugios",
        "ciclovia", "ciclofaixa", "gramados", "jardim", "cruzamento", "contramão", "contramao",
        "fila dupla", "guia", "meio-fio", "cruzamento",
    }
    # For vehicle type in deixar de dar passagem
    vehicle_types = {"polícia", "policia", "incêndio", "incendio", "ambulância", "ambulancia",
                     "socorro", "salvamento", "bombeiro", "fiscalização", "fiscalizacao",
                     "batedores"}
    # For document/condition types
    doc_types = {"cnh", "ppd", "carteira nacional", "permissão", "permissao",
                 "cassada", "suspensão", "suspensao", "vencida", "categoria",
                 "lentes", "aparelho", "audição", "audicao", "adaptações", "adaptacoes",
                 "prótese", "protese", "cursos"}

    # If one has location words and the other has different location words
    loc_a = ents_a & location_words
    loc_b = ents_b & location_words
    if loc_a and loc_b and loc_a != loc_b:
        return True, f"different locations: {loc_a} vs {loc_b}"

    # If one has vehicle type words and the other has different ones
    veh_a = ents_a & vehicle_types
    veh_b = ents_b & vehicle_types
    if veh_a and veh_b and veh_a != veh_b:
        return True, f"different vehicle types: {veh_a} vs {veh_b}"

    # If one has specific doc/condition words not in the other
    doc_a = ents_a & doc_types
    doc_b = ents_b & doc_types
    if doc_a and doc_b and doc_a != doc_b:
        return True, f"different conditions: {doc_a} vs {doc_b}"

    return False, ""


# --- 6. Group by cttu_code ---
def group_by_cttu(rows):
    groups = defaultdict(list)
    for row in rows:
        groups[row["cttu_code"]].append(row)
    return dict(groups)

# --- 7. Pick best description ---
def pick_best_description(entries, ctb_articles):
    """Pick the best canonical description from a set of merged entries."""
    # Priority: longest properly punctuated, properly accented one
    # Try to match CTB text if available
    descriptions = [(e["canonical_description"], e) for e in entries]
    # Score each description
    def score(desc):
        s = 0
        # Prefer well-accented text (more non-ASCII suggests better Portuguese)
        non_ascii = sum(1 for c in desc if ord(c) > 127)
        s += non_ascii * 0.01
        # Prefer longer descriptions (more complete)
        s += len(desc) * 0.001
        # Prefer not truncated (ending with proper punctuation)
        if desc.rstrip()[-1] in '.!?…':
            s += 10
        # Prefer descriptions that match CTB text better
        for art_key, ctb_desc in ctb_articles.items():
            if ctb_desc and len(ctb_desc) > 10:
                ratio = difflib.SequenceMatcher(None, normalize(desc), normalize(ctb_desc)).ratio()
                s += ratio * 5
        return s

    sorted_descs = sorted(descriptions, key=lambda x: score(x[0]), reverse=True)
    return sorted_descs[0][0]

def get_ctb_proposal(law_code, ctb_articles):
    """Check if CTB provides a better description for this law_code."""
    # Parse law_code like "Art. 162, Inc. I" or "ART. 253-A" etc.
    code = law_code.lower().replace("art.", "").replace("art ", "").strip()
    # Try to match
    for key, desc in ctb_articles.items():
        if key in code or code in key:
            return desc
    return None

# --- 8. Merge entries within a group ---
def merge_group(entries, ctb_articles):
    """
    Within a group of entries (same cttu_code), merge near-duplicates.
    Returns list of consolidated entries.
    """
    if len(entries) <= 1:
        return entries

    n = len(entries)
    # Build adjacency: which entries should be merged
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[ry] = rx

    for i in range(n):
        for j in range(i + 1, n):
            a = entries[i]["canonical_description"]
            b = entries[j]["canonical_description"]
            sim = similarity(a, b)
            contains = one_contains_other(a, b)
            different, reason = are_different_situations(a, b)

            if different:
                # Don't merge genuinely different situations
                continue

            if sim >= 0.85 or contains:
                union(i, j)

    # Collect merged groups
    groups_idx = defaultdict(list)
    for i in range(n):
        groups_idx[find(i)].append(i)

    merged = []
    merge_count = 0
    for root, indices in groups_idx.items():
        group_entries = [entries[i] for i in indices]
        if len(group_entries) == 1:
            merged.append(group_entries[0])
        else:
            merge_count += len(group_entries) - 1
            # Merge them
            best_desc = pick_best_description(group_entries, ctb_articles)
            # Combine all known_variants (deduplicated)
            all_variants = set()
            for e in group_entries:
                all_variants.update(e["known_variants"])
            # Also add the non-chosen canonical descriptions as variants
            for e in group_entries:
                if e["canonical_description"] != best_desc:
                    all_variants.add(e["canonical_description"])

            # Keep the lowest id
            lowest_id = min(e["id"] for e in group_entries)
            # Keep the first law_code and category from the lowest id entry
            rep = [e for e in group_entries if e["id"] == lowest_id][0]

            merged.append({
                "id": lowest_id,
                "cttu_code": rep["cttu_code"],
                "law_code": rep["law_code"],
                "canonical_description": best_desc,
                "known_variants": sorted(list(all_variants)),
                "category": rep["category"],
                "created_at": rep["created_at"],
            })

    return merged, merge_count


# --- 9. Main ---
def main():
    print("Loading data...")
    rows = parse_csv(INPUT_CSV)
    print(f"Loaded {len(rows)} entries from CSV")

    print("Loading CTB reference text...")
    ctb_articles = load_ctb_text(CTB_FILE)
    print(f"Extracted {len(ctb_articles)} CTB article descriptions")

    groups = group_by_cttu(rows)
    print(f"Found {len(groups)} distinct cttu_code groups")

    total_merges = 0
    consolidated = []
    merge_details = []

    for cttu, entries in sorted(groups.items()):
        if len(entries) > 1:
            merged_group, merges = merge_group(entries, ctb_articles)
            total_merges += merges
            if merges > 0:
                merge_details.append({
                    "cttu_code": cttu,
                    "law_code": entries[0]["law_code"],
                    "before": len(entries),
                    "after": len(merged_group),
                    "merges": merges,
                })
            consolidated.extend(merged_group)
        else:
            consolidated.extend(entries)

    # Sort by id
    consolidated.sort(key=lambda x: x["id"])

    print(f"\n{'='*70}")
    print(f"CONSOLIDATION RESULTS")
    print(f"{'='*70}")
    print(f"Entries before: {len(rows)}")
    print(f"Entries after:  {len(consolidated)}")
    print(f"Total merges:   {total_merges}")
    print(f"Reduction:      {len(rows) - len(consolidated)} entries ({100*(len(rows)-len(consolidated))/len(rows):.1f}%)")
    print(f"\nMerge details by cttu_code group:")
    print(f"{'CTTU':>6} {'Law Code':<45} {'Before':>6} {'After':>6} {'Merged':>6}")
    print("-" * 75)
    for d in sorted(merge_details, key=lambda x: -x["merges"]):
        print(f"{d['cttu_code']:>6} {d['law_code']:<45} {d['before']:>6} {d['after']:>6} {d['merges']:>6}")

    # Write output CSV
    print(f"\nWriting consolidated CSV to {OUTPUT_CSV}...")
    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "id", "cttu_code", "law_code", "canonical_description",
            "known_variants", "category", "created_at"
        ])
        writer.writeheader()
        for row in consolidated:
            writer.writerow({
                "id": row["id"],
                "cttu_code": row["cttu_code"],
                "law_code": row["law_code"],
                "canonical_description": row["canonical_description"],
                "known_variants": json.dumps(row["known_variants"], ensure_ascii=False),
                "category": row["category"],
                "created_at": row["created_at"],
            })

    print(f"Done! Output: {OUTPUT_CSV}")

    # Print some example merges
    print(f"\n{'='*70}")
    print(f"EXAMPLE MERGES (showing key consolidations)")
    print(f"{'='*70}")
    for d in merge_details[:15]:
        print(f"\nCTTU {d['cttu_code']} - {d['law_code']}: {d['before']} -> {d['after']} entries ({d['merges']} merged)")


if __name__ == "__main__":
    main()
