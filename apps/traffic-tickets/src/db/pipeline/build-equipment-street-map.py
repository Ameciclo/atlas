#!/usr/bin/env python3
"""
Pre-resolve equipment (semaforos + postes) -> official street (logradouros).
Generates semaphore-street-map.tsv and post-street-map.tsv so that
build-location-descriptions.py can use equipment as ground truth for
street matching (bypassing ambiguous agent-written location text).

Usage: python3 build-equipment-street-map.py [--apply]
"""

import csv
import os
import re
import sys
from collections import defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(DIR)))))
DATA_DIR = os.path.join(ROOT, "packages", "database", "seed-data", "traffic-tickets")
SEMAFORO_TSV = os.path.join(DATA_DIR, "auxiliary", "localizacao_semaforos.tsv")
POSTE_TSV = os.path.join(DATA_DIR, "auxiliary", "localizacao_postes.tsv")
LOGRADOURO_TSV = os.path.join(DATA_DIR, "auxiliary", "logradouros-bairro.tsv")
SEM_MAP_OUT = os.path.join(DATA_DIR, "semaphore-street-map.tsv")
POST_MAP_OUT = os.path.join(DATA_DIR, "post-street-map.tsv")

APPLY = "--apply" in sys.argv


# ===========================================================================
# Load reference tables
# ===========================================================================

def load_streets():
    streets = {}
    with open(LOGRADOURO_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            code = row.get("codlogradouro", "").strip()
            if code and code != "0":
                streets[int(code)] = {
                    "official_name": row.get("nome_oficial_logradouro", "").strip(),
                    "short_name": row.get("nome_logradouro_resumido", "").strip(),
                    "concatenated": row.get("nome_logradouro_concatenado", "").strip(),
                }
    return streets


# ===========================================================================
# Abbreviation expansion (identical to build-location-descriptions.py)
# ===========================================================================

EXPANDED_ABBREVIATIONS = {
    "DR.": "DOUTOR", "DR": "DOUTOR", "DRA.": "DOUTORA",
    "PROF.": "PROFESSOR", "PROF": "PROFESSOR",
    "ENG.": "ENGENHEIRO", "ENG": "ENGENHEIRO",
    "DES.": "DESEMBARGADOR", "DES": "DESEMBARGADOR",
    "SEN.": "SENADOR", "SEN": "SENADOR",
    "GOV.": "GOVERNADOR", "GOV": "GOVERNADOR",
    "CEL.": "CORONEL", "CEL": "CORONEL",
    "GEN.": "GENERAL", "GEN": "GENERAL",
    "GAL.": "GENERAL", "GAL": "GENERAL",
    "MAL.": "MARECHAL", "MAL": "MARECHAL",
    "MIN.": "MINISTRO", "MIN": "MINISTRO",
    "DEP.": "DEPUTADO", "DEP": "DEPUTADO",
    "PREF.": "PREFEITO", "PREF": "PREFEITO",
    "PRES.": "PRESIDENTE", "PRES": "PRESIDENTE",
    "COM.": "COMENDADOR", "COM": "COMENDADOR",
    "MAJ.": "MAJOR", "MAJ": "MAJOR",
    "CAP.": "CAPITAO", "CAP": "CAPITAO",
    "TEN.": "TENENTE", "TEN": "TENENTE",
    "PAD.": "PADRE", "PAD": "PADRE",
    "CDE.": "CONDE",
    "CONS.": "CONSELHEIRO",
    "ARQ.": "ARQUITETO",
    "ADV.": "ADVOGADO",
    "JORN.": "JORNALISTA",
    "VER.": "VEREADOR",
}

TYPE_ABBREV = [
    (r'^AVENIDA\s+', 'AVENIDA '),
    (r'^AV\.?\s+', 'AVENIDA '),
    (r'^AV\.(\S)', r'AVENIDA \1'),
    (r'^R\.\s+', 'RUA '),
    (r'^R\s+', 'RUA '),
    (r'^RUA\.\s+', 'RUA '),
    (r'^PRC\.?\s+', 'PRACA '),
    (r'^PRACA\.\s+', 'PRACA '),
    (r'^PCA\.?\s+', 'PRACA '),
    (r'^PA\.\s+', 'PRACA '),
    (r'^ESTR\.?\s+', 'ESTRADA '),
    (r'^ESTRADA\.\s+', 'ESTRADA '),
    (r'^EST\.?\s+', 'ESTRADA '),
    (r'^TRAV\.?\s+', 'TRAVESSA '),
    (r'^TRV\.?\s+', 'TRAVESSA '),
    (r'^TRAVESSA\.\s+', 'TRAVESSA '),
    (r'^PTE\.?\s+', 'PONTE '),
    (r'^PONTE\.\s+', 'PONTE '),
    (r'^C\.?\s+', 'CAIS '),
    (r'^ROD\.?\s+', 'RODOVIA '),
    (r'^RODOVIA\.\s+', 'RODOVIA '),
    (r'^BEC\.?\s+', 'BECO '),
    (r'^BECO\.\s+', 'BECO '),
    (r'^LAD\.?\s+', 'LADEIRA '),
    (r'^LADEIRA\.\s+', 'LADEIRA '),
    (r'^AL\.?\s+', 'ALAMEDA '),
    (r'^ALAMEDA\.\s+', 'ALAMEDA '),
    (r'^SUB\.?\s+', 'SUBIDA '),
    (r'^SUBIDA\.\s+', 'SUBIDA '),
]

def remove_accents(s):
    import unicodedata
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("utf-8")

def expand_abbreviations(text):
    result = text.upper().strip()
    for abbr, expanded in sorted(EXPANDED_ABBREVIATIONS.items(), key=lambda x: -len(x[0])):
        escaped = re.escape(abbr)
        pattern = re.compile(r'\b' + escaped + r'(?=\s|$)', re.I)
        result = pattern.sub(expanded, result)
    return result


# ===========================================================================
# Street name normalization (extract type + name from a location string)
# ===========================================================================

STREET_TYPE_RE = re.compile(
    r'^(RUA|AVENIDA|PRACA|ESTRADA|TRAVESSA|CORREGO|PONTE|VIADUTO|'
    r'LARGO|BECO|ALAMEDA|CANAL|RODOVIA|CAIS|PRAIA|SUBIDA|LADEIRA)\s+'
)

def normalize_equipment_name(raw_name):
    """Normalize a location string from equipment data into a clean 'TYPE NAME' string."""
    if not raw_name or not raw_name.strip():
        return None

    upper = raw_name.upper().strip()

    # Skip non-street descriptions
    if re.match(r'^(EM\s+FRENTE|AO\s+LADO|SOB\s+|PROX\.?\s|PR[OÓ]X\.?\s|ANTES\s|AP[OÓ]S\s|ESTA[CÇ][AÃ]O\s|ENTRADA\s|LADO\s|PISTA\s|CORREDOR\s|SOBRE\s|SOBREO\s)', upper):
        return None
    if re.match(r'^E/Git$', upper):
        return None
    if re.match(r'^\d{3,}', upper):
        return None
    if len(upper) < 6:
        return None

    # Expand abbreviations
    expanded = expand_abbreviations(upper)

    # Normalize street type abbreviations
    for pattern, replacement in TYPE_ABBREV:
        expanded = re.sub(pattern, replacement, expanded, count=1)

    # Match known street type
    m = STREET_TYPE_RE.match(expanded)
    if m:
        street_type = m.group(1)
        rest = expanded[m.end():].strip()

        # Cut at first separator
        sep = re.search(r'\s*(?:,|SEMAFORO|POSTE|DEFRONTE|SENTIDO|'
                        r'EM\s+FRENTE|SOB\s+O|AO\s+LADO|LADO\s+OPOSTO|'
                        r'\bAPOS\b|\bANTES\b|PROXIMO|JUNTO|PONTO\s+DE|'
                        r'CRUZAMENTO|NR\s*\d|NUMERO|FRENTE|X\s+(?!\d)|'
                        r'REF\s|ESQUINA|\d{3,})', rest)
        street_name = rest[:sep.start()].strip() if sep else rest.strip()

        if street_name and len(street_name) > 2:
            return f"{street_type} {street_name}"

    return None


# ===========================================================================
# Tokenization and matching (same logic as build-location-descriptions.py)
# ===========================================================================

STOP_WORDS = {"DE", "DA", "DO", "DOS", "DAS", "E", "EM", "NO", "NA", "AO", "AOS",
              "COM", "SEM", "SOB", "ATE", "O", "A", "OS", "AS", "PARA", "PELA",
              "PELO", "PELOS", "PELAS"}

STREET_RENAMES = {
    "NORTE": "NORTE MIGUEL ARRAES DE ALENCAR",
    "SUL": "SUL CID SAMPAIO",
}

def tokenize_name(name):
    if not name:
        return set()
    n = remove_accents(name.upper().strip())
    n = re.sub(r'[^A-Z0-9\s]', '', n)
    return {t for t in n.split() if len(t) > 2 and t not in STOP_WORDS}

def build_inverted_index(streets):
    index = defaultdict(set)
    for code, s in streets.items():
        tokens = (tokenize_name(s["official_name"]) |
                  tokenize_name(s["concatenated"]))
        for t in tokens:
            index[t].add(code)
    return index

def match_by_tokens(name, index, streets):
    if not name:
        return None

    name = name.upper()
    for old, new in STREET_RENAMES.items():
        name = re.sub(r'\b' + old + r'\b', new, name)

    tokens = tokenize_name(name)
    if not tokens:
        return None

    candidates = set()
    for t in tokens:
        candidates |= index.get(t, set())
    if not candidates:
        return None

    best_code = None
    best_score = 0

    for code in candidates:
        street_tokens = (tokenize_name(streets[code]["official_name"]) |
                         tokenize_name(streets[code]["concatenated"]))
        inter = len(tokens & street_tokens)
        if inter == 0:
            continue
        score = inter / len(tokens)
        if score > best_score:
            best_score = score
            best_code = code

    if best_code and best_score >= 0.50:
        return (best_code, streets[best_code]["official_name"], best_score)
    return None


# ===========================================================================
# Equipment extraction
# ===========================================================================

def extract_semaphore_streets():
    """Extract unique street names from semaphore location fields."""
    streets = set()
    sem_raw = {}  # sem_num -> [(raw, loc_index), ...]

    with open(SEMAFORO_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            num = row.get("semaforo", "").strip()
            if not num:
                continue
            entries = sem_raw.setdefault(int(num), [])
            for loc_idx, field in enumerate(["localizacao1", "localizacao2"], 1):
                raw = row.get(field, "").strip()
                if not raw:
                    continue
                entries.append((raw, loc_idx))
                norm = normalize_equipment_name(raw)
                if norm:
                    streets.add(norm)

    return streets, sem_raw

def extract_post_streets():
    """Extract unique street names from post address fields."""
    streets = set()
    post_raw = {}

    with open(POSTE_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            code = row.get("barrament0", "").strip()
            if not code:
                continue
            raw = row.get("endereco", "").strip()
            if not raw:
                continue
            post_raw[code] = raw

            # Try the full address first (it often starts with the street name)
            norm = normalize_equipment_name(raw)
            if norm:
                streets.add(norm)
                continue

            # Try splitting at comma and using just the first part
            parts = raw.split(",")
            for part in parts:
                norm = normalize_equipment_name(part.strip())
                if norm:
                    streets.add(norm)
                    break

    return streets, post_raw


# ===========================================================================
# Build per-equipment maps
# ===========================================================================

def build_semaphore_map(sem_raw, name_to_match, streets_catalog):
    """For each semaphore, find ALL street matches (both loc1 and loc2).
    Returns {sem_num: [(code, official, score, raw_location, loc_index), ...]}"""
    sem_map = {}
    for sem_num, entries in sem_raw.items():
        matches = []
        for raw, loc_idx in entries:
            norm = normalize_equipment_name(raw)
            if norm and norm in name_to_match:
                code, official, score = name_to_match[norm]
                matches.append((code, official, score, raw, loc_idx))
        if matches:
            sem_map[sem_num] = matches
    return sem_map

def build_post_map(post_raw, name_to_match, streets_catalog):
    """For each post, find the best street match. Returns {code: (c, official, score, raw)}"""
    post_map = {}
    for code, raw in post_raw.items():
        # Try full address first
        norm = normalize_equipment_name(raw)
        if norm and norm in name_to_match:
            c, official, score = name_to_match[norm]
            post_map[code] = (c, official, score, raw)
            continue

        # Try comma-separated parts
        for part in raw.split(","):
            norm = normalize_equipment_name(part.strip())
            if norm and norm in name_to_match:
                c, official, score = name_to_match[norm]
                post_map[code] = (c, official, score, raw)
                break
    return post_map


# ===========================================================================
# Main
# ===========================================================================

def main():
    print("=" * 60)
    print("Building Equipment -> Street Map")
    print()

    print("Loading street catalog...")
    streets_catalog = load_streets()
    print(f"  {len(streets_catalog):,} streets loaded")
    print()

    print("Building token index...")
    index = build_inverted_index(streets_catalog)
    print(f"  {len(index):,} tokens indexed")
    print()

    # --- Extract unique street names from equipment ---
    print("Extracting street names from semaphores...")
    sem_streets, sem_raw = extract_semaphore_streets()
    print(f"  {len(sem_raw):,} semaphores -> {len(sem_streets):,} unique street names")

    print("Extracting street names from posts...")
    post_streets, post_raw = extract_post_streets()
    print(f"  {len(post_raw):,} posts -> {len(post_streets):,} unique street names")
    print()

    # --- Match unique streets against catalog ---
    all_unique = sem_streets | post_streets
    print(f"Matching {len(all_unique):,} unique equipment street names against catalog...")

    name_to_match = {}  # normalized_name -> (street_code, official_name, score)
    stats = {"exact": 0, "matched": 0, "unmatched": 0}
    unmatched = []

    for name in sorted(all_unique):
        match = match_by_tokens(name, index, streets_catalog)
        if match:
            score = match[2]
            stats["matched"] += 1
            if score >= 0.90:
                stats["exact"] += 1
            name_to_match[name] = match
        else:
            stats["unmatched"] += 1
            unmatched.append(name)

    print(f"  Exact (>=0.90):     {stats['exact']:,}")
    print(f"  Matched total:      {stats['matched']:,}")
    print(f"  Unmatched:          {stats['unmatched']:,}")
    print()

    if unmatched and len(unmatched) <= 30:
        print("Unmatched street names:")
        for name in unmatched:
            print(f"  - {name}")
        print()

    # --- Build per-equipment maps ---
    print("Building semaphore map...")
    sem_map = build_semaphore_map(sem_raw, name_to_match, streets_catalog)
    print(f"  {len(sem_map):,} / {len(sem_raw):,} semaphores mapped")

    print("Building post map...")
    post_map = build_post_map(post_raw, name_to_match, streets_catalog)
    print(f"  {len(post_map):,} / {len(post_raw):,} posts mapped")
    print()

    if not APPLY:
        print("[DRY-RUN] Use --apply to write output files.")
        return

    # --- Write semaphore map ---
    sem_entry_count = 0
    with open(SEM_MAP_OUT, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(["semaforo", "street_code", "street_name", "score", "raw_location", "location_index"])
        for sem_num in sorted(sem_map.keys()):
            for code, name, score, raw_loc, loc_idx in sem_map[sem_num]:
                writer.writerow([sem_num, code, name, f"{score:.3f}", raw_loc, loc_idx])
                sem_entry_count += 1
    print(f"Semaphore map written: {SEM_MAP_OUT} ({sem_entry_count} entries for {len(sem_map)} semaphores)")

    # --- Write post map ---
    with open(POST_MAP_OUT, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow(["post_code", "street_code", "street_name", "score", "raw_address"])
        for code in sorted(post_map.keys()):
            c, name, score, raw = post_map[code]
            writer.writerow([code, c, name, f"{score:.3f}", raw])
    print(f"Post map written: {POST_MAP_OUT} ({len(post_map)} entries)")

    print()
    print("=" * 60)
    print("Done.")


if __name__ == "__main__":
    main()
