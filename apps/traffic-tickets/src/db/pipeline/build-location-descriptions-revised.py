#!/usr/bin/env python3
"""
Build enriched location dictionary (data/location-descriptions.tsv) with:
1. Sequential location_id for every unique location string
2. Equipment resolution (semaphores + posts -> lat/lon via lookup tables)
3. Street name extraction (street_type, street_name, street_code)
4. Preserved raw text for inverse geocoding
5. Confidence scoring (high/medium/low)

Usage: python3 build-location-descriptions.py [--apply]
"""

import csv
import os
import pickle
import re
import sys
from collections import Counter, defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(DIR)))))
DATA_DIR = os.path.join(ROOT, "packages", "database", "seed-data", "traffic-tickets")
INFRA_DIR = os.path.join(DATA_DIR, "source-data")
SEMAFORO_TSV = os.path.join(DATA_DIR, "auxiliary", "localizacao_semaforos.tsv")
POSTE_TSV = os.path.join(DATA_DIR, "auxiliary", "localizacao_postes.tsv")
LOGRADOURO_TSV = os.path.join(DATA_DIR, "auxiliary", "logradouros-bairro.tsv")
DICT_TSV_OUT = os.path.join(DATA_DIR, "location-descriptions.tsv")
CHECKPOINT_FILE = os.path.join(DATA_DIR, ".build-locations-checkpoint.pkl")
SEM_MAP_TSV = os.path.join(DATA_DIR, "semaphore-street-map.tsv")
POST_MAP_TSV = os.path.join(DATA_DIR, "post-street-map.tsv")

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

def load_semaphore_map():
    """Load semaphore-street-map.tsv -> {sem_num: (street_code, street_name, score)}"""
    smap = {}
    if not os.path.exists(SEM_MAP_TSV):
        return smap
    with open(SEM_MAP_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            code = row.get("street_code", "").strip()
            if code:
                smap[int(row["semaforo"])] = (int(code), row.get("street_name", ""), float(row.get("score", 0)))
    return smap

def load_post_map():
    """Load post-street-map.tsv -> {post_code: (street_code, street_name, score)}"""
    pmap = {}
    if not os.path.exists(POST_MAP_TSV):
        return pmap
    with open(POST_MAP_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            code = row.get("street_code", "").strip()
            if code:
                pmap[row["post_code"]] = (int(code), row.get("street_name", ""), float(row.get("score", 0)))
    return pmap

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
        escaped = re.escape(abbr)
        pattern = re.compile(r'\b' + escaped + r'(?=\s|$)', re.I)
        result = pattern.sub(expanded, result)
    return result

# ===========================================================================
# Extraction functions
# ===========================================================================

SEMAPHORE_RE = re.compile(
    r'(?:SEM|SMF)[A-ZÁÀÂÃÄF]*\.?\s*(?:,\s*)?(?:DE\s+)?(?:N[º°R.]?\s*)?(\d{3,4})', re.I
)

POST_RE = re.compile(
    r'POSTE\S*\.?\s*(?:DE\s+)?(?:N[Mº°R.]*\s*)?([BH]\d{6})\b', re.I
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

# Street types are metadata, not part of the proper street name.
# Keeping them out of token scoring allows "AVENIDA AMELIA" to match
# a catalog entry stored simply as "AMELIA".
STREET_TYPE_TOKENS = set(STREET_TYPE_MAP.values())

# Street renames: old names that changed over time
STREET_RENAMES = {
    "NORTE": "NORTE MIGUEL ARRAES DE ALENCAR",
    "SUL": "SUL CID SAMPAIO",
}

# Title priority for disambiguation: higher = more prominent street
TITLE_PRIORITY = {
    "GOVERNADOR": 100, "PRESIDENTE": 90, "IMPERADOR": 85,
    "MARQUES": 80, "VISCONDE": 75, "CONDE": 75, "BARAO": 70,
    "CORONEL": 60, "GENERAL": 60, "MARECHAL": 60,
    "SENADOR": 55, "MINISTRO": 55,
    "DEPUTADO": 50, "DESEMBARGADOR": 50,
    "DOUTOR": 45, "PROFESSOR": 40, "CONSELHEIRO": 40, "BRIGADEIRO": 40,
    "ENGENHEIRO": 35, "PREFEITO": 35, "VEREADOR": 30,
    "ARQUITETO": 25, "JORNALISTA": 25, "ADVOGADO": 20,
    "PADRE": 15, "CAPITAO": 10, "TENENTE": 10, "MAJOR": 10, "COMENDADOR": 10,
}

def _semaphore_confirms_candidate(sem_num, candidate_code, streets_dict, semaphores):
    """Check if semaphore loc1 or loc2 references the candidate street."""
    if not semaphores or sem_num not in semaphores:
        return False
    s = semaphores[sem_num]
    candidate_norm = remove_accents(streets_dict[candidate_code]["official_name"].upper())
    for loc_field in [s.get("loc1", ""), s.get("loc2", "")]:
        c_tokens = tokenize_name(candidate_norm)
        l_tokens = tokenize_name(loc_field)
        if c_tokens & l_tokens:
            return True
    return False

def _candidate_title_sum(candidate_tokens):
    return sum(TITLE_PRIORITY.get(t, 0) for t in candidate_tokens)

def _street_type_match(candidate_code, query_street_type, streets_dict):
    if not query_street_type:
        return 0
    qtype = query_street_type.upper()
    for field in ("official_name", "short_name", "concatenated"):
        if qtype in streets_dict[candidate_code].get(field, "").upper():
            return 1
    return 0

def _resolve_ties(tied_codes, query_tokens, streets_dict, semaphores=None,
                  semaphore_number=None, query_street_type=None):
    """Break ties among street codes with the same best token score.
    Rules: fewer extra tokens > semaphore confirmation > street type match > title priority.
    """
    if len(tied_codes) <= 1:
        return tied_codes
    scored = []
    for code in tied_codes:
        c_tokens = (tokenize_name(streets_dict[code]["official_name"]) |
                    tokenize_name(streets_dict[code]["concatenated"]))
        extra = len(c_tokens - query_tokens)
        sem_bonus = 1 if _semaphore_confirms_candidate(semaphore_number, code, streets_dict, semaphores) else 0
        type_match = _street_type_match(code, query_street_type, streets_dict)
        title = _candidate_title_sum(c_tokens)
        scored.append((extra, -sem_bonus, -type_match, -title, code))
    scored.sort(key=lambda x: (x[0], x[1], x[2], x[3]))
    return [s[4] for s in scored]

def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, "rb") as f:
            return pickle.load(f)
    return None

def save_checkpoint(enriched, next_id, stats):
    data = {"enriched": enriched, "next_id": next_id, "stats": dict(stats)}
    tmp = CHECKPOINT_FILE + ".tmp"
    with open(tmp, "wb") as f:
        pickle.dump(data, f)
    os.replace(tmp, CHECKPOINT_FILE)

def tokenize_name(name, exclude_street_types=False):
    """Normalize and tokenize a street name into significant words.

    Abbreviations are expanded symmetrically for both the query and catalog.
    Street types may be excluded because they are metadata, not the proper name.
    """
    if not name:
        return set()
    n = expand_abbreviations(name)
    n = remove_accents(n.upper().strip())
    n = re.sub(r'[^A-Z0-9\s]', '', n)
    tokens = {t for t in n.split() if len(t) > 2 and t not in STOP_WORDS}
    if exclude_street_types:
        tokens -= STREET_TYPE_TOKENS
    return tokens


def _street_token_variants(street):
    """Return distinct token sets for official, short and concatenated names."""
    variants = []
    seen = set()
    for field in ("official_name", "short_name", "concatenated"):
        tokens = tokenize_name(street.get(field, ""), exclude_street_types=True)
        frozen = frozenset(tokens)
        if tokens and frozen not in seen:
            variants.append(tokens)
            seen.add(frozen)
    return variants


def _catalog_street_types(street):
    """Return explicit street types found at the beginning of catalog variants."""
    types = set()
    for field in ("official_name", "short_name", "concatenated"):
        value = street.get(field, "")
        if not value:
            continue
        street_type, _ = extract_street_parts(value)
        if street_type:
            types.add(street_type)
    return types


def build_inverted_index(streets_dict):
    """Build token -> street-code index from all catalog name variants.

    Street types are excluded so they can never become the rare-token anchor.
    """
    index = defaultdict(set)
    for code, street in streets_dict.items():
        for tokens in _street_token_variants(street):
            for token in tokens:
                index[token].add(code)
    print(f"  Inverted index: {len(index)} tokens")
    return index


def match_by_tokens(extracted_name, index, streets_dict,
                    semaphores=None, semaphore_number=None, query_street_type=None):
    """Match only the street name, refusing unresolved ambiguities.

    Candidate retrieval remains fast: it uses at most the two rarest useful
    name tokens. Ranking is lexicographic:
      1. fewer query tokens missing from the candidate;
      2. no explicit street-type conflict;
      3. fewer candidate tokens absent from the query.

    A catalog entry with no explicit street type is neutral. Two candidates
    with the same best rank are considered ambiguous and return None.
    """
    name = extracted_name.upper()
    for old, new in STREET_RENAMES.items():
        # Avoid duplicating an already-expanded historical name.
        if new not in name:
            name = re.sub(r'\b' + re.escape(old) + r'\b', new, name)

    query_tokens = tokenize_name(name, exclude_street_types=True)
    if not query_tokens:
        return None

    # Titles help scoring (ENGENHEIRO vs GOVERNADOR), but should not be the
    # retrieval anchor when a proper-name token is available.
    title_tokens = set(TITLE_PRIORITY)
    selector_tokens = [
        token for token in query_tokens
        if token not in title_tokens and token in index
    ]
    if not selector_tokens:
        selector_tokens = [token for token in query_tokens if token in index]
    if not selector_tokens:
        return None

    # Two rare anchors protect against one stray/noisy token without scanning
    # the whole catalog. Alphabetical tie-break makes this deterministic.
    anchors = sorted(
        selector_tokens,
        key=lambda token: (len(index[token]), token),
    )[:2]

    candidates = set()
    for token in anchors:
        candidates.update(index[token])

    qtype = query_street_type.upper() if query_street_type else None
    ranked = []

    for code in candidates:
        street = streets_dict[code]
        candidate_types = _catalog_street_types(street)
        type_conflict = int(
            bool(qtype and candidate_types and qtype not in candidate_types)
        )

        best_variant = None
        for candidate_tokens in _street_token_variants(street):
            intersection = query_tokens & candidate_tokens
            if not intersection:
                continue

            missing = query_tokens - candidate_tokens
            extra = candidate_tokens - query_tokens
            recall = len(intersection) / len(query_tokens)
            precision = len(intersection) / len(candidate_tokens)
            score = (
                2 * recall * precision / (recall + precision)
                if recall + precision else 0.0
            )
            rank = (len(missing), type_conflict, len(extra))

            item = {
                "code": code,
                "rank": rank,
                "score": score,
                "missing": len(missing),
                "candidate_types": candidate_types,
            }
            if best_variant is None or (rank, -score) < (
                best_variant["rank"], -best_variant["score"]
            ):
                best_variant = item

        if best_variant:
            ranked.append(best_variant)

    if not ranked:
        return None

    ranked.sort(key=lambda item: (
        item["rank"],
        -item["score"],
        streets_dict[item["code"]]["official_name"],
        item["code"],
    ))
    best = ranked[0]

    # Conservative coverage rule: a complete query-token match is accepted.
    # With four or more tokens, at most one missing token may still be accepted.
    if best["missing"] > 0:
        if len(query_tokens) < 4 or best["missing"] > 1:
            return None

    # Same best evidence means the name alone cannot distinguish the streets.
    if len(ranked) > 1 and ranked[1]["rank"] == best["rank"]:
        return None

    # If the query omitted the type and the leading candidates belong to
    # different explicit types, do not guess between e.g. Avenida and Ponte.
    if not qtype and len(ranked) > 1:
        second = ranked[1]
        known_types = best["candidate_types"] | second["candidate_types"]
        if (
            best["missing"] == second["missing"]
            and len(known_types) > 1
            and best["candidate_types"] != second["candidate_types"]
        ):
            return None

    code = best["code"]
    return (code, streets_dict[code]["official_name"], best["score"])

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

    print("Loading equipment street maps...")
    sem_street_map = load_semaphore_map()
    post_street_map = load_post_map()
    print(f"  Semaphore map: {len(sem_street_map):,} entries")
    print(f"  Post map:      {len(post_street_map):,} entries")
    if not sem_street_map and not post_street_map:
        print("  WARNING: No equipment maps found. Run build-equipment-street-map.py first.")
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
    cp = load_checkpoint()
    if cp:
        enriched = cp["enriched"]
        next_id = cp["next_id"]
        stats = defaultdict(int, cp.get("stats", {}))
        print(f"  Resuming from checkpoint: {len(enriched):,} entries already processed")
    else:
        enriched = {}
        next_id = 1
        stats = defaultdict(int)

    CHECKPOINT_EVERY = 50000
    last_checkpoint = len(enriched)
    
    for loc_text, count in loc_counts.items():
        if loc_text in enriched:
            continue

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
            "street_code": None,
            "street_name_matched": None,
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

        # Equipment-first street matching: use pre-built maps as ground truth
        if equip_number and not entry["street_code"]:
            if equip_type == "semaphore" and int(equip_number) in sem_street_map:
                code, name, score = sem_street_map[int(equip_number)]
                entry["street_code"] = code
                entry["street_name_matched"] = name
                entry["confidence"] = "high"
                stats["equipment_street_resolved"] += 1
            elif equip_type == "post" and equip_number in post_street_map:
                code, name, score = post_street_map[equip_number]
                entry["street_code"] = code
                entry["street_name_matched"] = name
                entry["confidence"] = "high"
                stats["equipment_street_resolved"] += 1

        # Extract street parts (always extract, but DON'T match here - deferred to match-pipeline)
        street_type, street_name = extract_street_parts(loc_text, direction)
        if street_type:
            entry["street_type"] = street_type
        if street_name:
            entry["street_name"] = street_name
            stats["street_extracted"] += 1

            # Token-based matching: fallback when no equipment street code available
            if not entry["street_code"]:
                full_name = f"{street_type or ''} {street_name}".strip()
                sem_num = int(equip_number) if equip_type == "semaphore" and equip_number else None
                match = match_by_tokens(full_name, inverted_index, streets, semaphores, sem_num, street_type)
                if match:
                    entry["street_code"] = match[0]
                    entry["street_name_matched"] = match[1]
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
        if not entry["street_code"] and entry["confidence"] != "high":
            if re.search(r'AEROP(?:ORTO)?', loc_text, re.I):
                entry["street_code"] = 66923  # Praça Ministro Salgado Filho
                entry["confidence"] = "medium"
                entry["needs_review"] = True
                stats["landmark_aeroporto"] += 1
        
        # Extract address number
        addr_num = extract_address_number(loc_text)
        if addr_num:
            entry["address_number"] = addr_num
        
        # Mark confidence and review status (don't overwrite equipment or token matches)
        if entry["confidence"] == "low" and not entry["street_code"]:
            if entry["street_name"]:
                entry["confidence"] = "medium"
            else:
                entry["needs_review"] = True
        
        enriched[loc_text] = entry
        next_id += 1
        
        if next_id % 100000 == 0:
            print(f"  Processed {next_id:,}...", flush=True)
        if next_id - last_checkpoint >= CHECKPOINT_EVERY and APPLY:
            save_checkpoint(enriched, next_id, stats)
            last_checkpoint = next_id
            print(f"  Checkpoint saved at {next_id:,}", flush=True)
    
    print(f"  Total entries: {len(enriched):,}")
    print()
    
    # Stats
    print("Resolution stats:")
    print(f"  Semaphore matched:      {stats['semaphore_matched']:,}")
    print(f"  Post matched:           {stats['post_matched']:,}")
    print(f"  Semaphore unmatched:    {stats.get('semaphore_unmatched', 0):,}")
    print(f"  Post unmatched:         {stats.get('post_unmatched', 0):,}")
    print(f"  Equipment street resolved: {stats.get('equipment_street_resolved', 0):,}")
    print(f"  Street name extracted:  {stats.get('street_extracted', 0):,}")
    print(f"  Needs review (no equipment, no street name): {sum(1 for e in enriched.values() if e['needs_review']):,}")
    print()
    
    if not APPLY:
        print("[DRY-RUN] Use --apply to write output files.")
        return
    
    # Write enriched TSV
    with open(DICT_TSV_OUT, "w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, delimiter="\t", lineterminator="\n")
        writer.writerow([
            "location_id", "raw_description", "extracted_street",
            "street_type", "street_code", "semaphore_number",
            "address_number", "direction", "reference_point",
        ])
        for loc_text, entry in enriched.items():
            ref_point = entry.get("equipment_address") or ""
            cross = entry.get("cross_street") or ""
            if ref_point and cross:
                ref_point = f"{ref_point} ({cross})"
            elif not ref_point:
                ref_point = cross

            writer.writerow([
                entry["id"],
                loc_text.replace("\t", " ").replace("\n", " "),
                entry.get("street_name_matched") or "",
                entry.get("street_type") or "",
                entry.get("street_code") or "",
                entry.get("equipment_number") or "",
                entry.get("address_number") or "",
                entry.get("direction") or "",
                ref_point.replace("\t", " ").replace("\n", " "),
            ])
    print(f"Enriched TSV written: {DICT_TSV_OUT}")
    if os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
    print()
    print("=" * 60)
    print("Done.")

if __name__ == "__main__":
    main()
