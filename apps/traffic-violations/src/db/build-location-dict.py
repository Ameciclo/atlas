#!/usr/bin/env python3
"""
Build enriched location dictionary (dict_locais_v3.json) with:
1. Sequential location_id for every unique location string
2. Equipment resolution (semaphores + posts → lat/lon via lookup tables)
3. Street name extraction (street_type, street_name, street_code)
4. Preserved raw text for inverse geocoding
5. Confidence scoring (high/medium/low)

Usage: python3 build-location-dict.py [--apply]
"""

import csv
import json
import os
import re
import sys
from collections import Counter, defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
INFRA_DIR = os.path.join(DIR, "all-infracoes")
SEMAFORO_TSV = os.path.join(DIR, "localizacao_semaforos.tsv")
POSTE_TSV = os.path.join(DIR, "localizacao_postes.tsv")
LOGRADOURO_TSV = os.path.join(DIR, "logradouros-bairro.tsv")
DICT_OUT = os.path.join(DIR, "dict_locais_v3.json")
LOCATIONS_OUT = os.path.join(DIR, "traffic_locations_v3.tsv")
SQL_OUT = os.path.join(DIR, "migrations/0001_seed_traffic_locations.sql")

APPLY = "--apply" in sys.argv

# ===========================================================================
# Equipment lookup tables
# ===========================================================================

def load_semaphores():
    """Return dict: semaphore_number (int) -> {loc1, loc2, bairro, lat, lon}"""
    table = {}
    with open(SEMAFORO_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            num = row.get("semaforo", "").strip()
            if num:
                table[int(num)] = {
                    "loc1": row.get("localizacao1", "").strip(),
                    "loc2": row.get("localizacao2", "").strip(),
                    "bairro": row.get("bairro", "").strip(),
                    "lat": row.get("latitude", "").strip(),
                    "lon": row.get("longitude", "").strip(),
                }
    return table

def load_posts():
    """Return dict: post_code (str) -> {endereco, bairro, lat, lon}"""
    table = {}
    with open(POSTE_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            code = row.get("barrament0", "").strip()
            if code:
                table[code] = {
                    "endereco": row.get("endereco", "").strip(),
                    "bairro": row.get("bairro", "").strip(),
                    "lat": row.get("latitude", "").strip(),
                    "lon": row.get("longitude", "").strip(),
                }
    return table

def load_streets():
    """Return dict: street_code (int) -> {official_name, short_name, concatenated, bairro}"""
    streets = {}
    with open(LOGRADOURO_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            code = row.get("codlogradouro", "").strip()
            if code and code != "0":
                streets[int(code)] = {
                    "official_name": row.get("nome_oficial_logradouro", "").strip(),
                    "short_name": row.get("nome_logradouro_resumido", "").strip(),
                    "concatenated": row.get("nome_logradouro_concatenado", "").strip(),
                    "bairro_name": row.get("nomeBairro", "").strip(),
                    "bairro_code": row.get("codbairro", "").strip(),
                }
    return streets

# ===========================================================================
# Street type/abbreviation normalization (ported from street-normalizer.ts)
# ===========================================================================

STREET_TYPE_MAP = {
    "RUA": "RUA", "R.": "RUA", "RUA.": "RUA",
    "AVENIDA": "AVENIDA", "AV.": "AVENIDA", "AV": "AVENIDA",
    "PRACA": "PRACA", "PRC.": "PRACA", "PRC": "PRACA",
    "ESTRADA": "ESTRADA", "ESTR.": "ESTRADA",
    "TRAVESSA": "TRAVESSA", "TRAV.": "TRAVESSA", "TRV": "TRAVESSA",
    "CORREGO": "CORREGO",
    "PONTE": "PONTE", "PTE": "PONTE",
    "VIADUTO": "VIADUTO",
    "LARGO": "LARGO",
    "BECO": "BECO",
    "ALAMEDA": "ALAMEDA",
    "CANAL": "CANAL",
    "RODOVIA": "RODOVIA",
    "CAIS": "CAIS",
    "PRAIA": "PRAIA",
    "SUBIDA": "SUBIDA",
    "LADEIRA": "LADEIRA",
}

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

def remove_accents(s):
    import unicodedata
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("utf-8")

def expand_abbreviations(text):
    result = text.upper().strip()
    for abbr, expanded in sorted(EXPANDED_ABBREVIATIONS.items(), key=lambda x: -len(x[0])):
        pattern = re.compile(r'\b' + re.escape(abbr.replace('.', '\\.')) + r'(?=\s|$)', re.I)
        result = pattern.sub(expanded, result)
    return result

# ===========================================================================
# Extraction functions
# ===========================================================================

SEMAPHORE_RE = re.compile(
    r'SEMAF[OÓ]R[OÓ]?\s*(?:N[º°R.]?\s*)?(\d{3,4})', re.I
)

POST_RE = re.compile(
    r'POSTE\s+(?:DE\s+)?(?:NR|N[º°R.]?)\s*([A-Z]?\d{4,8})', re.I
)

DIRECTION_PATTERNS = [
    (r'SENTIDO\s+SUBURBIO', 'SENTIDO SUBURBIO'),
    (r'SENTIDO\s+PRAIA', 'SENTIDO PRAIA'),
    (r'SENTIDO\s+UNICO', 'SENTIDO UNICO'),
    (r'SENTIDO\s+CID[./]SUB', 'SENTIDO CID/SUB'),
    (r'SENTIDO\s+SUB[./]CID', 'SENTIDO SUB/CID'),
    (r'SENTIDO\s+CIDADE[./]SUBURBIO', 'SENTIDO CID/SUB'),
    (r'SENTIDO\s+SUBURBIO[./]CIDADE', 'SENTIDO SUB/CID'),
    (r'SENTIDO\s+NORTE', 'SENTIDO NORTE'),
    (r'SENTIDO\s+SUL', 'SENTIDO SUL'),
    (r'SENTIDO\s+CENTRO', 'SENTIDO CENTRO'),
    (r'SENTIDO\s+OLINDA', 'SENTIDO OLINDA'),
    (r'SENTIDO\s+BOA\s+VIAGEM', 'SENTIDO BOA VIAGEM'),
    (r'SENTIDO\s+DERBY', 'SENTIDO DERBY'),
    (r'SENTIDO\s+MARCO\s+ZERO', 'SENTIDO MARCO ZERO'),
    (r'SENTIDO\s+CIDADE', 'SENTIDO CIDADE'),
    (r'SENTIDO\s+MADALENA', 'SENTIDO MADALENA'),
    (r'SENTIDO\s+ENCRUZILHADA', 'SENTIDO ENCRUZILHADA'),
    (r'SENTIDO\s+AFOGADOS', 'SENTIDO AFOGADOS'),
    (r'SENTIDO\s+IMBIRIBEIRA', 'SENTIDO IMBIRIBEIRA'),
    (r'SENTIDO\s+IPSEP', 'SENTIDO IPSEP'),
    (r'SENTIDO\s+BOA\s+VISTA', 'SENTIDO BOA VISTA'),
    (r'SENTIDO\s+BR\s*232', 'SENTIDO BR 232'),
    (r'SENTIDO\s+BONGI', 'SENTIDO BONGI'),
    (r'SENTIDO\s+CEASA', 'SENTIDO CEASA'),
    (r'SENTIDO\s+DO\s+MERCADO\s+SAO\s+JOSE', 'SENTIDO MERCADO SAO JOSE'),
    (r'SENTIDO\s+DA\s+RUA\s+FLORIANO\s+PEIXOTO', 'SENTIDO RUA FLORIANO PEIXOTO'),
    (r'SENTIDO\s+DA\s+RUA\s+SAO\s+JOAO', 'SENTIDO RUA SAO JOAO'),
    (r'SENTIDO\s+DA\s+RUA\s+DA\s+PRAIA', 'SENTIDO RUA DA PRAIA'),
    (r'SENTIDO\s+DA\s+RUA\s+DA\s+CONCORDIA', 'SENTIDO RUA DA CONCORDIA'),
    (r'SENTIDO\s+DA\s+PRACA\s+DEZESSETE', 'SENTIDO PRACA DEZESSETE'),
    (r'SENTIDO\s+DA\s+RUA\s+PASSO\s+DA\s+PATRIA', 'SENTIDO RUA PASSO DA PATRIA'),
]

def extract_equipment(raw):
    """Extract equipment references from location string."""
    result = {"type": None, "number": None, "matched": False, "address": None, "neighborhood": None, "latitude": None, "longitude": None}
    
    upper = raw.upper()
    
    # Semaphore
    m = SEMAPHORE_RE.search(upper)
    if m:
        num = int(m.group(1))
        result["type"] = "semaphore"
        result["number"] = str(num)
        return result, "semaphore", str(num)
    
    # Post
    m = POST_RE.search(upper)
    if m:
        code = m.group(1)
        result["type"] = "post"
        result["number"] = code
        return result, "post", code
    
    return result, None, None

def extract_direction(raw):
    """Extract direction/sense from location string."""
    upper = raw.upper()
    for pattern, label in DIRECTION_PATTERNS:
        m = re.search(pattern, upper)
        if m:
            return label
    return None

def extract_address_number(raw):
    """Extract address number from EM FRENTE, DEFRONTE, NR/N/Nº patterns.
    Excludes SEMAFORO and POSTE numbers (captured by equipment extraction)."""
    upper = raw.upper()
    
    # NR / N. / Nº prefix — but NOT when preceded by SEMAFORO or POSTE
    m = re.search(r'(?<!SEMAFORO\s)(?<!POSTE\s)(?:NR|N[º°]|N\.?)\s*(\d+)', upper)
    if m: return m.group(1)
    
    # EM FRENTE [AO] [NUMERO] {digits} — captures all variations:
    # "EM FRENTE AO 312", "EM FRENTE 1688", "EM FRENTE AO NUMERO 5152", "AONUMERO5030"
    m = re.search(r'EM\s+FRENTE\s+(?:AO\s*)?(?:NUMERO\s*)?(\d+)', upper)
    if m: return m.group(1)
    
    # DEFRONTE [AO] [NUMERO] {digits}
    m = re.search(r'DEFRONTE\s+(?:AO\s*)?(?:NUMERO\s*)?(\d+)', upper)
    if m: return m.group(1)
    
    return None

def extract_street_parts(raw, direction=None):
    """Extract street type and name from a location string."""
    upper = raw.upper().strip()
    # Remove direction suffix
    if direction:
        idx = upper.find(direction)
        if idx >= 0:
            upper = upper[:idx].strip()
    
    # Remove common suffixes (use \b to avoid substring matches)
    upper = re.sub(r'\s*[,;]\s*$', '', upper)
    upper = re.sub(r'\s*(?:EM\s+FRENTE|DEFRONTE|PROXIMO|PROX\.|AO\s+LADO|SOB\s+O?|\bAPOS\b|\bANTES\b|ENTRE|JUNTO\s+A).*$', '', upper, flags=re.I)
    upper = re.sub(r'\s*(?:SENTIDO\s*$|SENT\.?\s*$|REF\s*$|FAIXA\s*$)', '', upper)
    
    # Expand abbreviations
    expanded = expand_abbreviations(upper)
    
    # Strip leading REF prefix (refúgio/referência) — actual street name comes after
    expanded = re.sub(r'^REF\s+', '', expanded)
    
    # Remove double street prefixes "RUA AVENIDA" -> "AVENIDA"
    expanded = re.sub(r'^RUA\s+(AVENIDA|PRACA|TRAVESSA|ESTRADA)\s+', r'\1 ', expanded)
    
    # Normalize street type abbreviations BEFORE the type regex
    # "AV BEBERIBE" → "AVENIDA BEBERIBE", "R. DA BAIXA" → "RUA DA BAIXA", etc.
    type_abbrev = [
        (r'^AVENIDA\s+', 'AVENIDA '),
        (r'^AV\.?\s+', 'AVENIDA '),
        (r'^AV\.(\S)', r'AVENIDA \1'),   # "AV.BOA" → "AVENIDA BOA"
        (r'^R\.\s+', 'RUA '),
        (r'^R\s+', 'RUA '),            # "R DA CONCORDIA" → "RUA DA CONCORDIA"
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
        (r'^C\.?\s+', 'CAIS '),            # "C SANTA RITA" ou "C. SANTA RITA" → "CAIS SANTA RITA"
    ]
    for pattern, replacement in type_abbrev:
        expanded = re.sub(pattern, replacement, expanded, count=1)
    
    # Try to match known street types
    type_pattern = r'^(RUA|AVENIDA|PRACA|ESTRADA|TRAVESSA|CORREGO|PONTE|VIADUTO|LARGO|BECO|ALAMEDA|CANAL|RODOVIA|CAIS|PRAIA|SUBIDA|LADEIRA)\s+'
    m = re.match(type_pattern, expanded)
    
    if m:
        street_type = m.group(1)
        rest = expanded[m.end():].strip()
        
        # Split at first separator to get pure street name
        # All separator keywords use \b to avoid substring matches (e.g., "NAVEGANTES" ≠ "ANTES")
        sep = re.search(r'\s*(?:,|SEMAFORO|POSTE|DEFRONTE|SENTIDO|'
                        r'EM\s+FRENTE|SOB\s+O|AO\s+LADO|LADO\s+OPOSTO|'
                        r'NO\s+SEMAFORO|\bAPOS\b|\bANTES\b|PROXIMO|JUNTO|PONTO\s+DE|REF\s|'
                        r'CRUZAMENTO|A\s+PARTIR|PASSANDO|SEMF?\s*\d*|SUB\s*/\s*CID|CID\s*/\s*SUB|'
                        r'NR\s*\d|NUMERO|FRENTE|SENT\s|LADO\s+OESTE|LADO\s+LESTE|ESQUINA|ENFRENTE)', rest)
        street_name = rest[:sep.start()].strip() if sep else rest.strip()
        
        return street_type, street_name
    
    # No recognized type
    first_comma = expanded.find(',')
    name_part = expanded[:first_comma].strip() if first_comma >= 0 else expanded
    sep = re.search(r'\s+(?:SEMAFORO|POSTE|DEFRONTE|SENTIDO|EM\s+FRENTE)', name_part)
    extracted = name_part[:sep.start()].strip() if sep else name_part
    
    return None, extracted if extracted else None

def extract_cross_street(raw):
    """Detect if location contains a cross street reference and extract both streets."""
    upper = raw.upper()
    # "CRUZAMENTO", "CRUZ", " X " (but not in "N X"), " COM "
    patterns = [
        r'CRUZAMENTO\s+(?:COM\s+)?(.+?)(?:\s+SENTIDO|\s*$)',
        r'\s+CRUZ\s+(?:COM\s+)?(.+?)(?:\s+SENTIDO|\s*$)',
        r'\s+X\s+(?!\d)(.+?)(?:\s+SENTIDO|\s*$)',
        r'\s+COM\s+(.+?)(?:\s+SENTIDO|\s*$)',
    ]
    for pattern in patterns:
        m = re.search(pattern, upper)
        if m:
            cross = m.group(1).strip().rstrip(',.')
            if len(cross) > 3:
                return cross
    return None

def normalize_street_for_match(name):
    """Normalize a street name for matching against official catalog."""
    n = name.upper().strip()
    n = expand_abbreviations(n)
    n = re.sub(r'\s+', ' ', n)
    n = remove_accents(n)
    return n

def build_street_index(streets):
    """Build lookup maps for fast street matching."""
    exact = {}     # normalized name -> (code, official_name)
    contained = [] # list of (normalized_name, code, official_name)
    
    for code, s in streets.items():
        off_norm = normalize_street_for_match(s["official_name"])
        conc_norm = normalize_street_for_match(s["concatenated"])
        short_norm = normalize_street_for_match(s["short_name"])
        
        exact[off_norm] = (code, s["official_name"])
        if conc_norm != off_norm:
            exact[conc_norm] = (code, s["official_name"])
        if short_norm not in exact:
            exact[short_norm] = (code, s["official_name"])
        
        contained.append((off_norm, code, s["official_name"]))
    
    return exact, contained

def match_street_name_fast(name, exact_index, contained_index):
    """Match extracted street name using pre-built indices."""
    if not name or len(name) < 4:
        return None
    
    norm = normalize_street_for_match(name)
    
    # Pass 1: Exact match via hash map
    if norm in exact_index:
        code, official = exact_index[norm]
        return (code, official, "high")
    
    # Pass 2: Contained match
    best = None
    best_len = 0
    for off_norm, code, official in contained_index:
        if norm in off_norm or off_norm in norm:
            match_len = min(len(norm), len(off_norm))
            if match_len > best_len:
                best_len = match_len
                best = (code, official, "medium")
    
    if best:
        return best
    
    # Pass 3: Levenshtein (only for streets within ~30% length range to limit search)
    best_score = 0
    best_match = None
    nlen = len(norm)
    for off_norm, code, official in contained_index:
        if abs(len(off_norm) - nlen) > nlen * 0.3:
            continue
        sim = levenshtein_similarity(norm, off_norm)
        if sim > 0.82 and sim > best_score:
            best_score = sim
            best_match = (code, official, "low")
    
    return best_match

def levenshtein_similarity(a, b):
    """Normalized Levenshtein similarity (0-1)."""
    m, n = len(a), len(b)
    if m == 0 and n == 0: return 1.0
    if m == 0 or n == 0: return 0.0
    
    prev = list(range(n + 1))
    for i in range(1, m + 1):
        curr = [i] + [0] * n
        for j in range(1, n + 1):
            cost = 0 if a[i-1] == b[j-1] else 1
            curr[j] = min(curr[j-1] + 1, prev[j] + 1, prev[j-1] + cost)
        prev = curr
    return 1.0 - prev[n] / max(m, n)

# ===========================================================================
# Main processing
# ===========================================================================

STOP_WORDS = {"DE", "DA", "DO", "DOS", "DAS", "E", "EM", "NO", "NA", "AO", "AOS", "COM", "SEM", "SOB", "ATE", "O", "A", "OS", "AS", "PARA", "PELA", "PELO", "PELOS", "PELAS"}

# Street renames: old names that changed over time
STREET_RENAMES = {
    "NORTE": "NORTE MIGUEL ARRAES DE ALENCAR",
    "SUL": "SUL CID SAMPAIO",
}

def tokenize_name(name):
    """Normalize and tokenize a street name into a set of significant words."""
    if not name: return set()
    # Remove accents, uppercase, strip non-alpha
    n = remove_accents(name.upper().strip())
    n = re.sub(r'[^A-Z0-9\s]', '', n)
    return {t for t in n.split() if len(t) > 2 and t not in STOP_WORDS}

def build_inverted_index(streets_dict):
    """Build inverted index: token → set of street codes.
    streets_dict: {code: {official_name, short_name, concatenated, bairro_name, bairro_code}}
    """
    index = defaultdict(set)
    for code, s in streets_dict.items():
        tokens = tokenize_name(s["official_name"]) | tokenize_name(s["concatenated"])
        for t in tokens:
            index[t].add(code)
    print(f"  Inverted index: {len(index)} tokens")
    return index

def match_by_tokens(extracted_name, index, streets_dict):
    """Match extracted street name against official streets using token similarity.
    Uses intersection / len(extracted_tokens) for scoring (forgiving with noise).
    Returns (street_code, official_name, score) or None.
    """
    # Apply street renames before tokenizing (e.g., AVENIDA NORTE → AVENIDA NORTE MIGUEL ARRAES)
    name = extracted_name.upper()
    for old, new in STREET_RENAMES.items():
        name = re.sub(r'\b' + old + r'\b', new, name)
    
    tokens = tokenize_name(name)
    if not tokens:
        return None
    
    # Find candidate streets that share at least one token
    candidates = set()
    for t in tokens:
        candidates |= index.get(t, set())
    
    if not candidates:
        return None
    
    # Score each candidate by token overlap
    best_code = None
    best_score = 0
    for code in candidates:
        street_tokens = tokenize_name(streets_dict[code]["official_name"]) | tokenize_name(streets_dict[code]["concatenated"])
        inter = len(tokens & street_tokens)
        if inter == 0:
            continue
        # Score: what fraction of extracted tokens match the official street?
        # More forgiving than Jaccard when extraction includes noise.
        score = inter / len(tokens)
        if score > best_score:
            best_score = score
            best_code = code
    
    if best_code and best_score >= 0.40:
        return (best_code, streets_dict[best_code]["official_name"], best_score)
    return None

def main():
    print("=" * 60)
    print("Building Enriched Location Dictionary")
    print()
    
    # Load reference tables
    print("Loading reference tables...")
    semaphores = load_semaphores()
    posts = load_posts()
    streets = load_streets()
    print(f"  Semaphores: {len(semaphores)}")
    print(f"  Posts:      {len(posts)}")
    print(f"  Streets:    {len(streets)} (for post-ETL matching pipeline)")
    print()
    
    # Build inverted index for token-based street matching
    print("Building inverted index for street matching...")
    inverted_index = build_inverted_index(streets)
    print()
    
    # Extract all unique locations with counts
    print("Extracting locations from 19 raw files...")
    tsv_years = {"2007", "2008", "2009", "2010", "2011", "2012", "2025"}
    loc_counts = Counter()
    
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
                    if len(row) < 9: continue
                    law, loc = row[7].strip(), row[8].strip()
                    if law.upper().startswith("ART."):
                        loc_counts[loc] += 1
            else:
                reader = csv.reader(f, delimiter=";")
                next(reader)
                for row in reader:
                    if len(row) < 7: continue
                    val6 = row[6].strip().replace('"', '') if len(row) > 6 else ''
                    val7 = row[7].strip().replace('"', '') if len(row) > 7 else ''
                    is_l6 = val6.upper().startswith("ART.")
                    is_l7 = val7.upper().startswith("ART.")
                    law = val7 if (is_l7 and not is_l6) else val6
                    loc = val6 if (is_l7 and not is_l6) else val7
                    if law.upper().startswith("ART."):
                        loc_counts[loc.replace('"', '')] += 1
    
    print(f"  Unique locations: {len(loc_counts):,}")
    print(f"  Total rows: {sum(loc_counts.values()):,}")
    print()
    
    # Build enriched dictionary
    print("Building enriched dictionary...")
    enriched = {}
    next_id = 1
    
    stats = defaultdict(int)
    
    for loc_text, count in loc_counts.items():
        entry = {
            "id": next_id,
            "raw": loc_text,
            "count": count,
            "equipment_type": None,
            "equipment_number": None,
            "equipment_address": None,
            "equipment_neighborhood": None,
            "latitude": None,
            "longitude": None,
            "street_type": None,
            "street_name": None,
            "matched_street_code": None,
            "matched_street_name": None,
            "cross_street": None,
            "direction": None,
            "address_number": None,
            "confidence": "low",
            "needs_review": False,
        }
        
        # Extract direction
        direction = extract_direction(loc_text)
        if direction:
            entry["direction"] = direction
        
        # Extract equipment
        equip_data, equip_type, equip_number = extract_equipment(loc_text)
        if equip_number:
            entry["equipment_type"] = equip_type
            entry["equipment_number"] = equip_number
            
            if equip_type == "semaphore" and int(equip_number) in semaphores:
                s = semaphores[int(equip_number)]
                entry["equipment_address"] = f"{s['loc1']} x {s['loc2']}"
                entry["equipment_neighborhood"] = s["bairro"]
                entry["latitude"] = s["lat"]
                entry["longitude"] = s["lon"]
                entry["confidence"] = "high"
                stats["semaphore_matched"] += 1
            elif equip_type == "post" and equip_number in posts:
                p = posts[equip_number]
                entry["equipment_address"] = p["endereco"]
                entry["equipment_neighborhood"] = p["bairro"]
                entry["latitude"] = p["lat"]
                entry["longitude"] = p["lon"]
                entry["confidence"] = "high"
                stats["post_matched"] += 1
            else:
                stats[f"{equip_type}_unmatched"] += 1
        
        # Extract street parts (always extract, but DON'T match here - deferred to match-pipeline)
        street_type, street_name = extract_street_parts(loc_text, direction)
        if street_type:
            entry["street_type"] = street_type
        if street_name:
            entry["street_name"] = street_name
            stats["street_extracted"] += 1
            
            # Try token-based matching against official streets
            full_name = f"{street_type or ''} {street_name}".strip()
            match = match_by_tokens(full_name, inverted_index, streets)
            if match:
                entry["matched_street_code"] = match[0]
                entry["matched_street_name"] = match[1]
                entry["confidence"] = "high" if match[2] >= 0.75 else "medium"
                if match[2] >= 0.75:
                    stats["token_match_high"] += 1
                elif match[2] >= 0.60:
                    stats["token_match_good"] += 1
                else:
                    stats["token_match_low"] += 1
                    entry["needs_review"] = True
            else:
                stats["token_unmatched"] += 1
        
        # Extract cross street
        cross = extract_cross_street(loc_text)
        if cross:
            entry["cross_street"] = cross
        
        # Landmark fallback: if still unmatched and mentions known landmark, use default street code
        if not entry["matched_street_code"] and entry["confidence"] != "high":
            if re.search(r'AEROP(?:ORTO)?', loc_text, re.I):
                entry["matched_street_code"] = 66923  # Praça Ministro Salgado Filho
                entry["confidence"] = "medium"
                entry["needs_review"] = True
                stats["landmark_aeroporto"] += 1
        
        # Extract address number
        addr_num = extract_address_number(loc_text)
        if addr_num:
            entry["address_number"] = addr_num
        
        # Mark confidence and review status (don't overwrite equipment or token matches)
        if entry["confidence"] == "low" and not entry["matched_street_code"]:
            if entry["street_name"]:
                entry["confidence"] = "medium"
            else:
                entry["needs_review"] = True
        
        enriched[loc_text] = entry
        next_id += 1
        
        if next_id % 100000 == 0:
            print(f"  Processed {next_id:,}...", flush=True)
    
    print(f"  Total entries: {len(enriched):,}")
    print()
    
    # Stats
    print("Resolution stats:")
    print(f"  Semaphore matched:      {stats['semaphore_matched']:,}")
    print(f"  Post matched:           {stats['post_matched']:,}")
    print(f"  Semaphore unmatched:    {stats.get('semaphore_unmatched', 0):,}")
    print(f"  Post unmatched:         {stats.get('post_unmatched', 0):,}")
    print(f"  Street name extracted:  {stats.get('street_extracted', 0):,}")
    print(f"  Needs review (no equipment, no street name): {sum(1 for e in enriched.values() if e['needs_review']):,}")
    print()
    
    if not APPLY:
        print("[DRY-RUN] Use --apply to write output files.")
        return
    
    # Write enriched dict
    with open(DICT_OUT, "w", encoding="utf-8") as f:
        json.dump(enriched, f, ensure_ascii=False, indent=2)
    print(f"Enriched dict written: {DICT_OUT}")
    
    # Write TSV for traffic_locations
    with open(LOCATIONS_OUT, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow([
            "location_id", "raw_description", "equipment_type", "equipment_number",
            "equipment_address", "equipment_neighborhood", "latitude", "longitude",
            "street_type", "street_name", "matched_street_code", "matched_street_name",
            "cross_street", "direction", "address_number", "confidence", "needs_review", "count"
        ])
        for entry in enriched.values():
            writer.writerow([
                entry["id"], entry["raw"],
                entry["equipment_type"] or "", entry["equipment_number"] or "",
                entry["equipment_address"] or "", entry["equipment_neighborhood"] or "",
                entry["latitude"] or "", entry["longitude"] or "",
                entry["street_type"] or "", entry["street_name"] or "",
                entry["matched_street_code"] or "", entry["matched_street_name"] or "",
                entry["cross_street"] or "", entry["direction"] or "",
                entry["address_number"] or "", entry["confidence"],
                entry["needs_review"], entry["count"]
            ])
    print(f"Locations TSV written: {LOCATIONS_OUT}")
    
    # Generate SQL seed
    with open(SQL_OUT, "w", encoding="utf-8") as f:
        f.write("-- Seed traffic_locations from enriched dictionary\n")
        f.write("-- Run AFTER migration 0000_add_traffic_locations_equipment.sql\n\n")
        f.write("TRUNCATE traffic_locations RESTART IDENTITY CASCADE;\n\n")
        
        batch_size = 5000
        entries = sorted(enriched.values(), key=lambda x: x["id"])
        
        for i in range(0, len(entries), batch_size):
            batch = entries[i:i + batch_size]
            values = []
            for e in batch:
                raw_safe = e["raw"].replace("'", "''")
                street_safe = (e["street_name"] or "").replace("'", "''")
                equip_addr_safe = (e["equipment_address"] or "").replace("'", "''")
                
                values.append(
                    f"({e['id']}, '{raw_safe}', "
                    f"'{street_safe}', "
                    f"'{e['street_type'] or ''}', "
                    f"{e['matched_street_code'] or 'NULL'}, "
                    f"'{e['equipment_number'] or ''}', "
                    f"'{e['address_number'] or ''}', "
                    f"'{equip_addr_safe}', "
                    f"'{e['confidence']}', "
                    f"{str(e['needs_review']).upper()}, "
                    f"'{e['direction'] or ''}')"
                )
            f.write(
                f"INSERT INTO traffic_locations "
                f"(location_id, raw_description, extracted_street, street_type, "
                f"matched_street_code, semaphore_number, address_number, "
                f"equipment_address, confidence, needs_review, direction)\n"
                f"VALUES {', '.join(values)};\n\n"
            )
        
        f.write(f"-- Total: {len(enriched):,} locations\n")
    print(f"SQL seed written: {SQL_OUT}")
    
    print()
    print("=" * 60)
    print("Done.")

if __name__ == "__main__":
    main()
