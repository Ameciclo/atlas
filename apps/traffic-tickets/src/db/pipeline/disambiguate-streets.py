#!/usr/bin/env python3
"""
Street name disambiguator — detects and resolves name collisions when
multiple official streets share the same core tokens.

Provides detailed output showing how matches change with tie-breaking rules.

Usage:
  python3 disambiguate-streets.py                        # test cases (Agamenon)
  python3 disambiguate-streets.py --filter AGAMENON      # all locations with keyword
  python3 disambiguate-streets.py --ties                 # full scan for ties/mismatches
  python3 disambiguate-streets.py --raw "AV. GOV. AGAMENON MAGALHAES, SOB O SEMAFORO N. 037"
"""

import csv
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict

DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(DIR)))))
DATA_DIR = os.path.join(ROOT, "packages", "database", "seed-data", "traffic-tickets")

SEMAFORO_TSV = os.path.join(DATA_DIR, "auxiliary", "localizacao_semaforos.tsv")
LOGRADOURO_TSV = os.path.join(DATA_DIR, "auxiliary", "logradouros-bairro.tsv")
LOCATIONS_TSV = os.path.join(DATA_DIR, "location-descriptions.tsv")

# ===========================================================================
# Normalization (mirrors build-location-descriptions.py)
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
    "BRIG.": "BRIGADEIRO", "BRIG": "BRIGADEIRO",
}

STOP_WORDS = {"DE", "DA", "DO", "DOS", "DAS", "E", "EM", "NO", "NA", "AO", "AOS",
              "COM", "SEM", "SOB", "ATE", "O", "A", "OS", "AS", "PARA", "PELA",
              "PELO", "PELOS", "PELAS"}

SEMAPHORE_RE = re.compile(r'SEMAF[OÓ]R[OÓ]?\s*(?:N[º°R.]?\s*)?(\d{3,4})', re.I)

# Titles with higher priority = more prominent/well-known streets
TITLE_PRIORITY = {
    "GOVERNADOR": 100,
    "PRESIDENTE": 90,
    "IMPERADOR": 85,
    "MARQUES": 80,
    "VISCONDE": 75,
    "CONDE": 75,
    "BARAO": 70,
    "CORONEL": 60,
    "GENERAL": 60,
    "MARECHAL": 60,
    "SENADOR": 55,
    "MINISTRO": 55,
    "DEPUTADO": 50,
    "DESEMBARGADOR": 50,
    "DOUTOR": 45,
    "PROFESSOR": 40,
    "CONSELHEIRO": 40,
    "BRIGADEIRO": 40,
    "ENGENHEIRO": 35,
    "PREFEITO": 35,
    "VEREADOR": 30,
    "ARQUITETO": 25,
    "JORNALISTA": 25,
    "ADVOGADO": 20,
    "PADRE": 15,
    "CAPITAO": 10,
    "TENENTE": 10,
    "MAJOR": 10,
    "COMENDADOR": 10,
}


def remove_accents(s):
    return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("utf-8")


def expand_abbreviations(text):
    """Expand abbreviations like GOV. -> GOVERNADOR, AV. -> AVENIDA."""
    result = text.upper().strip()
    for abbr, expanded in sorted(EXPANDED_ABBREVIATIONS.items(),
                                 key=lambda x: -len(x[0])):
        escaped = re.escape(abbr)
        pattern = re.compile(r'\b' + escaped + r'(?=\s|$)', re.I)
        result = pattern.sub(expanded, result)
    return result


def tokenize_name(name):
    if not name:
        return set()
    n = remove_accents(name.upper().strip())
    n = re.sub(r'[^A-Z0-9\s]', '', n)
    return {t for t in n.split() if len(t) > 2 and t not in STOP_WORDS}


def extract_semaphore_number(raw):
    m = SEMAPHORE_RE.search(raw.upper())
    return int(m.group(1)) if m else None


def extract_street_parts(raw, direction=None):
    """Extract street type and name from a location string.
    Mirrors build-location-descriptions.py extract_street_parts.
    """
    upper = raw.upper().strip()
    if direction:
        idx = upper.find(direction)
        if idx >= 0:
            upper = upper[:idx].strip()

    upper = re.sub(r'\s*[,;]\s*$', '', upper)
    upper = re.sub(r'\s*(?:EM\s+FRENTE|DEFRONTE|PROXIMO|PROX\.|AO\s+LADO|SOB\s+O?|'
                   r'\bAPOS\b|\bANTES\b|ENTRE|JUNTO\s+A|CRUZAMENTO|SOB\s+AO?|'
                   r'NO\s+SEMAFORO|EM\s+FRENTE\s+O|LADO\s+OPOSTO\s+AO).*$',
                   '', upper, flags=re.I)
    upper = re.sub(r'\s*(?:SENTIDO\s*$|SENT\.?\s*$|REF\s*$|FAIXA\s*$)', '', upper)

    expanded = expand_abbreviations(upper)
    expanded = re.sub(r'^REF\s+', '', expanded)
    expanded = re.sub(r'^RUA\s+(AVENIDA|PRACA|TRAVESSA|ESTRADA)\s+', r'\1 ', expanded)

    # Normalize street type abbreviations
    type_abbrev = [
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
    ]
    for pat, replacement in type_abbrev:
        expanded = re.sub(pat, replacement, expanded, count=1)

    type_pattern = (r'^(RUA|AVENIDA|PRACA|ESTRADA|TRAVESSA|CORREGO|PONTE|'
                    r'VIADUTO|LARGO|BECO|ALAMEDA|CANAL|RODOVIA|CAIS|PRAIA|'
                    r'SUBIDA|LADEIRA)\s+')
    m = re.match(type_pattern, expanded)

    if m:
        street_type = m.group(1)
        rest = expanded[m.end():].strip()

        sep = re.search(
            r'\s*(?:,|SEMAFORO|POSTE|DEFRONTE|SENTIDO|'
            r'EM\s+FRENTE|SOB\s+O|AO\s+LADO|LADO\s+OPOSTO|'
            r'NO\s+SEMAFORO|\bAPOS\b|\bANTES\b|PROXIMO|JUNTO|PONTO\s+DE|REF\s|'
            r'CRUZAMENTO|A\s+PARTIR|PASSANDO|SEMF?\s*\d*|'
            r'SUB\s*/\s*CID|CID\s*/\s*SUB|'
            r'NR\s*\d|NUMERO|FRENTE|SENT\s|LADO\s+OESTE|LADO\s+LESTE|ESQUINA|'
            r'ENFRENTE|X\s+COM)', rest)
        street_name = rest[:sep.start()].strip() if sep else rest.strip()
        return street_type, street_name

    first_comma = expanded.find(',')
    name_part = expanded[:first_comma].strip() if first_comma >= 0 else expanded
    sep = re.search(r'\s+(?:SEMAFORO|POSTE|DEFRONTE|SENTIDO|EM\s+FRENTE)', name_part)
    extracted = name_part[:sep.start()].strip() if sep else name_part
    return None, extracted if extracted else None


# ===========================================================================
# Data loading
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
                    "bairro_name": row.get("nomeBairro", "").strip(),
                    "bairro_code": row.get("codbairro", "").strip(),
                }
    return streets


def load_semaphores():
    table = {}
    with open(SEMAFORO_TSV, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            num = row.get("semaforo", "").strip()
            if num:
                table[int(num)] = {
                    "loc1": row.get("localizacao1", "").strip(),
                    "loc2": row.get("localizacao2", "").strip(),
                    "bairro": row.get("bairro", "").strip(),
                }
    return table


def build_inverted_index(streets):
    index = defaultdict(set)
    street_tokens = {}
    for code, s in streets.items():
        tokens = tokenize_name(s["official_name"]) | tokenize_name(s["concatenated"])
        street_tokens[code] = tokens
        for t in tokens:
            index[t].add(code)
    return index, street_tokens


# ===========================================================================
# Tie-breaking disambiguation
# ===========================================================================

def _candidate_title_sum(candidate_tokens):
    return sum(TITLE_PRIORITY.get(t, 0) for t in candidate_tokens)


def _semaphore_confirms_candidate(sem_num, candidate_code, streets, semaphores):
    """Check if semaphore loc1 or loc2 references the candidate street."""
    if sem_num not in semaphores:
        return False
    s = semaphores[sem_num]
    candidate_norm = remove_accents(streets[candidate_code]["official_name"].upper())

    for loc_field in [s["loc1"], s["loc2"]]:
        loc_norm = remove_accents(loc_field.upper())
        c_tokens = tokenize_name(candidate_norm)
        l_tokens = tokenize_name(loc_field)
        if c_tokens & l_tokens:
            return True
    return False


def _extra_token_penalty(candidate_code, query_tokens, street_tokens):
    """Number of tokens in candidate that are NOT in query."""
    return len(street_tokens[candidate_code] - query_tokens)


def _street_prevalence(candidate_code, streets):
    """Count how many times this street appears (by official_name)."""
    name = streets[candidate_code]["official_name"]
    return sum(1 for s in streets.values() if s["official_name"] == name)


def _street_type_match(candidate_code, query_street_type, streets):
    """Bonus if the candidate's street type matches the query's street type."""
    candidate_name = streets[candidate_code]["official_name"].upper()
    candidate_short = streets[candidate_code]["short_name"].upper()
    candidate_conc = streets[candidate_code]["concatenated"].upper()

    if not query_street_type:
        return 0
    if f"{query_street_type.upper()} " in candidate_name:
        return 1
    if query_street_type.upper() in candidate_short:
        return 1
    if query_street_type.upper() in candidate_conc:
        return 1
    return 0


def disambiguate_ties(tied_codes, query_tokens, street_tokens, streets,
                      semaphores=None, semaphore_number=None, query_street_type=None):
    """
    Break ties among `tied_codes` that achieved the same best token score.

    Rules (in priority order):
      1. Fewer extra tokens (candidate has fewer tokens NOT in query)
      2. Semaphore cross-reference (semaphore loc1/loc2 confirms the candidate)
      3. Street type match (exact match on type gets bonus)
      4. Title priority (higher-status titles preferred, e.g. GOVERNADOR > ENGENHEIRO)
      5. Prevalence (more neighborhood entries = more important street)
    """
    if len(tied_codes) <= 1:
        return tied_codes

    scored = []
    for code in tied_codes:
        extra = _extra_token_penalty(code, query_tokens, street_tokens)
        sem_bonus = 0
        if semaphores and semaphore_number:
            if _semaphore_confirms_candidate(semaphore_number, code, streets, semaphores):
                sem_bonus = 1
        type_match = _street_type_match(code, query_street_type, streets) if query_street_type else 0
        title = _candidate_title_sum(street_tokens[code])
        prevalence = _street_prevalence(code, streets)

        scored.append((extra, -sem_bonus, -type_match, -title, -prevalence, code))

    scored.sort(key=lambda x: (x[0], x[1], x[2], x[3], x[4]))
    return [s[5] for s in scored]


# ===========================================================================
# Matching engine (OLD: build-location-descriptions.py current logic)
# ===========================================================================

def match_old(extracted_name, index, streets_dict):
    """Current match_by_tokens logic from build-location-descriptions.py."""
    name = extracted_name.upper()
    tokens = tokenize_name(name)
    if not tokens:
        return None, 0, []

    candidates = set()
    for t in tokens:
        candidates |= index.get(t, set())
    if not candidates:
        return None, 0, []

    best_code = None
    best_score = 0
    all_scored = []

    for code in candidates:
        c_tokens = (tokenize_name(streets_dict[code]["official_name"]) |
                    tokenize_name(streets_dict[code]["concatenated"]))
        inter = len(tokens & c_tokens)
        if inter == 0:
            continue
        score = inter / len(tokens)
        all_scored.append((code, score))
        if score > best_score:
            best_score = score
            best_code = code

    all_scored.sort(key=lambda x: -x[1])
    return best_code, best_score, all_scored


# ===========================================================================
# Matching engine (NEW: with tie-breaking)
# ===========================================================================

def match_new(extracted_name, index, streets_dict, street_tokens,
              semaphores=None, semaphore_number=None, query_street_type=None):
    """Enhanced matching with tie-breaking disambiguation."""
    name = extracted_name.upper()
    tokens = tokenize_name(name)
    if not tokens:
        return None, 0, [], None

    candidates = set()
    for t in tokens:
        candidates |= index.get(t, set())
    if not candidates:
        return None, 0, [], None

    all_scored = []
    best_score = 0
    tied_at_best = []

    for code in candidates:
        c_tokens = street_tokens[code]
        inter = len(tokens & c_tokens)
        if inter == 0:
            continue
        score = inter / len(tokens)
        all_scored.append((code, score))
        if score > best_score:
            best_score = score
            tied_at_best = [code]
        elif score == best_score:
            tied_at_best.append(code)

    all_scored.sort(key=lambda x: -x[1])

    tie_broken = None
    if len(tied_at_best) > 1:
        tie_broken = disambiguate_ties(
            tied_at_best, tokens, street_tokens, streets_dict,
            semaphores, semaphore_number, query_street_type,
        )
        best_code = tie_broken[0]
    elif tied_at_best:
        best_code = tied_at_best[0]
    else:
        best_code = None

    return best_code, best_score, all_scored, tie_broken


# ===========================================================================
# Reporting
# ===========================================================================

def show_match(raw_text, expanded, street_type, street_name, full_name,
               sem_num, old_code, old_score, old_candidates,
               new_code, new_score, new_candidates, tie_broken,
               streets, street_tokens, semaphores):
    """Display a comparison of old vs new matching."""
    query_tokens = tokenize_name(full_name) if full_name else set()

    print(f"{'='*80}")
    print(f"RAW:     {raw_text}")
    if street_type or street_name:
        print(f"EXTRAÍDO: {full_name}")
        print(f"  tipo:   {street_type or '(nenhum)'}")
        print(f"  nome:   {street_name or '(nenhum)'}")
    print(f"EXPAND:  {expanded}")
    print(f"TOKENS:  {sorted(query_tokens)}")
    if sem_num:
        print(f"SEMA:    #{sem_num}")
        if sem_num in (semaphores or {}):
            s = semaphores[sem_num]
            print(f"         loc1: {s['loc1']}")
            print(f"         loc2: {s['loc2']}")
            print(f"         bairro: {s['bairro']}")
    print()

    # OLD
    print("--- ANTIGO (build-location-descriptions.py atual) ---")
    if old_code and old_code in streets:
        print(f"  VENCEDOR: [{old_code}] {streets[old_code]['official_name']}  score={old_score:.3f}")
    else:
        print(f"  VENCEDOR: nenhum (código={old_code})")
    print(f"  Candidatos (top 5):")
    for code, score in old_candidates[:5]:
        marker = " <-- ANTIGO" if code == old_code else ""
        extra = street_tokens[code] - query_tokens if street_tokens else set()
        name = streets.get(code, {}).get("official_name", f"#???")
        print(f"    [{code}] {name}  score={score:.3f}  extras={len(extra)}{marker}")
    print()

    # NEW
    print("--- NOVO (com desambiguação) ---")
    if new_code and new_code in streets:
        print(f"  VENCEDOR: [{new_code}] {streets[new_code]['official_name']}  score={new_score:.3f}")
    else:
        print(f"  VENCEDOR: nenhum (código={new_code})")

    if tie_broken and len(tie_broken) > 1:
        print(f"  Empate ({len(tie_broken)} candidatos c/ score={new_score:.3f}) resolvido por desambiguação:")
        for i, code in enumerate(tie_broken):
            marker = " <-- ESCOLHIDO" if i == 0 else ""
            extra = street_tokens[code] - query_tokens
            title = _candidate_title_sum(street_tokens[code])
            name = streets.get(code, {}).get("official_name", f"#???")
            print(f"    #{i+1}: [{code}] {name}  extras={len(extra)}  title_prio={title}{marker}")
    else:
        print(f"  Sem empate — decisão direta.")

    print(f"  Candidatos (top 5):")
    for code, score in new_candidates[:5]:
        marker = " <-- NOVO" if code == new_code else ""
        extra = street_tokens[code] - query_tokens
        name = streets.get(code, {}).get("official_name", f"#???")
        print(f"    [{code}] {name}  score={score:.3f}  extras={len(extra)}{marker}")
    print()

    if old_code != new_code:
        old_name = streets.get(old_code, {}).get("official_name", f"#{old_code}")
        new_name = streets.get(new_code, {}).get("official_name", f"#{new_code}")
        print(f"*** MUDOU! ***")
        print(f"  Antes: [{old_code}] {old_name}")
        print(f"  Agora: [{new_code}] {new_name}")
    else:
        print(f"  Resultado inalterado.")
    print()


def compare_single(raw_text, index, streets, street_tokens, semaphores):
    """Compare old vs new matching for a single raw location string."""
    # Extract street parts
    street_type, street_name = extract_street_parts(raw_text)
    full_name = f"{street_type or ''} {street_name}".strip()
    sem_num = extract_semaphore_number(raw_text)

    # Match with OLD logic
    old_code, old_score, old_cands = match_old(full_name, index, streets)

    # Match with NEW logic
    new_code, new_score, new_cands, tie_broken = match_new(
        full_name, index, streets, street_tokens, semaphores, sem_num, street_type
    )

    show_match(raw_text, expand_abbreviations(raw_text),
               street_type, street_name, full_name,
               sem_num, old_code, old_score, old_cands,
               new_code, new_score, new_cands, tie_broken,
               streets, street_tokens, semaphores)


def scan_dataset(index, streets, street_tokens, semaphores):
    """Scan all locations for ties and mismatches."""
    print("Carregando location-descriptions.tsv...")
    locations = []
    with open(LOCATIONS_TSV, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            locations.append(row)
    print(f"  {len(locations):,} localizações.\n")

    tie_cases = []
    mismatch_cases = []
    tie_street_pairs = Counter()
    mismatch_pairs = Counter()

    for i, row in enumerate(locations):
        raw = row.get("raw_description", "")
        old_code_str = row.get("street_code", "")
        old_code = int(old_code_str) if old_code_str and old_code_str.isdigit() else None
        if not raw:
            continue

        street_type, street_name = extract_street_parts(raw)
        full_name = f"{street_type or ''} {street_name}".strip()
        sem_num = extract_semaphore_number(raw)

        new_code, new_score, _, tie_broken = match_new(
            full_name, index, streets, street_tokens, semaphores, sem_num, street_type
        )

        # Track ties
        if tie_broken and len(tie_broken) > 1:
            tie_cases.append({
                "raw": raw, "old_code": old_code, "new_code": new_code,
                "score": new_score, "all_tied": tie_broken, "sem_num": sem_num,
            })
            codes = tuple(sorted(tie_broken[:2]))
            pair_name = " x ".join(streets.get(c, {}).get("official_name", f"#{c}")
                                   for c in codes if c in streets)
            tie_street_pairs[pair_name] += 1

        # Track mismatches
        if old_code and new_code and old_code != new_code:
            mismatch_cases.append({
                "raw": raw, "old_code": old_code, "new_code": new_code,
                "score": new_score, "sem_num": sem_num,
            })
            old_n = streets.get(old_code, {}).get("official_name", f"#{old_code}")
            new_n = streets.get(new_code, {}).get("official_name", f"#{new_code}")
            mismatch_pairs[f"{old_n} -> {new_n}"] += 1

        if (i + 1) % 200000 == 0:
            print(f"  Processado {i+1:,}...", flush=True)

    return tie_cases, mismatch_cases, tie_street_pairs, mismatch_pairs


# ===========================================================================
# Main
# ===========================================================================

def main():
    print("Carregando dados...")
    streets = load_streets()
    semaphores = load_semaphores()
    index, street_tokens = build_inverted_index(streets)
    print(f"  Ruas: {len(streets):,}")
    print(f"  Semáforos: {len(semaphores):,}")
    print(f"  Tokens no índice: {len(index):,}")
    print()

    # --raw "string"
    if "--raw" in sys.argv:
        idx = sys.argv.index("--raw")
        query = sys.argv[idx + 1] if idx + 1 < len(sys.argv) else ""
        if query:
            compare_single(query, index, streets, street_tokens, semaphores)
            return

    # --filter KEYWORD
    if "--filter" in sys.argv:
        idx = sys.argv.index("--filter")
        keyword = sys.argv[idx + 1].upper() if idx + 1 < len(sys.argv) else ""
        if not keyword:
            print("Uso: --filter KEYWORD"); return

        print(f"Buscando localizações contendo '{keyword}'...\n")
        groups = defaultdict(list)
        with open(LOCATIONS_TSV, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f, delimiter="\t"):
                raw = row.get("raw_description", "")
                if keyword.upper() not in raw.upper():
                    continue
                old_code_str = row.get("street_code", "")
                old_code = int(old_code_str) if old_code_str and old_code_str.isdigit() else None
                groups[old_code].append(raw)

        print(f"Encontradas {sum(len(v) for v in groups.values())} ocorrências:\n")
        for old_code, raws in sorted(groups.items(), key=lambda x: -len(x[1])):
            old_name = streets.get(old_code, {}).get("official_name", f"unk:{old_code}")
            print(f"  [{old_code}] {old_name}: {len(raws)} ocorrências")

        print(f"\n{'='*80}")
        print("Análise por grupo:\n")

        for old_code, raws in sorted(groups.items(), key=lambda x: -len(x[1])):
            sample = raws[0]
            old_name = streets.get(old_code, {}).get("official_name", f"unk:{old_code}")
            street_type, street_name = extract_street_parts(sample)
            full_name = f"{street_type or ''} {street_name}".strip()
            sem_num = extract_semaphore_number(sample)
            new_code, new_score, _, tie_broken = match_new(
                full_name, index, streets, street_tokens, semaphores, sem_num, street_type
            )
            changed = " *** MUDARIA ***" if new_code and new_code != old_code else ""
            new_name = streets.get(new_code, {}).get("official_name", "?")
            print(f"[{old_code}] {old_name} ({len(raws)} ocorrências){changed}")
            print(f"  Exemplo: {sample[:120]}")
            if new_code and new_code != old_code:
                print(f"  Novo match: [{new_code}] {new_name}")
            if tie_broken and len(tie_broken) > 1:
                print(f"  Empate entre:")
                tokens = tokenize_name(full_name)
                for i, c in enumerate(tie_broken[:5]):
                    m = " <-- ESCOLHIDO" if i == 0 else ""
                    extra = street_tokens[c] - tokens
                    name = streets.get(c, {}).get("official_name", f"#???")
                    print(f"    [{c}] {name}  extras={len(extra)}{m}")
            print()

        return

    # --ties
    if "--ties" in sys.argv:
        print("Escaneando dataset completo em busca de empates e mismatches...\n")
        tie_cases, mismatch_cases, tie_pairs, mismatch_pairs = scan_dataset(
            index, streets, street_tokens, semaphores
        )

        print(f"{'='*80}")
        print(f"RESULTADOS")
        print(f"{'='*80}\n")
        print(f"Empates detectados: {len(tie_cases):,}")
        print(f"Mismatches (código mudaria): {len(mismatch_cases):,}\n")

        print("Top pares de ruas que empatam:")
        for pair, count in tie_pairs.most_common(15):
            print(f"  {count:6,}  {pair}")
        print()

        print("Top mudanças (old -> new):")
        for pair, count in mismatch_pairs.most_common(15):
            print(f"  {count:6,}  {pair}")
        print()

        print("Exemplos de mismatches:\n")
        for case in mismatch_cases[:10]:
            if case["old_code"] in streets and case["new_code"] in streets:
                print(f"  {case['raw'][:120]}")
                print(f"    [{case['old_code']}] {streets[case['old_code']]['official_name']}")
                print(f"    -> [{case['new_code']}] {streets[case['new_code']]['official_name']}")
                print()
        return

    # Default: Agamenon test cases
    print("Testando casos de Agamenon Magalhães\n")

    test_cases = [
        "AV. GOV. AGAMENON MAGALHAES, SOB O SEMAFORO N. 037 SENTIDO OLINDA",
        "AV. AGAMENON MAGALHAES, SOB O SEMAFORO N. 174 SENTIDO BOA VIAGEM",
        "AV. ENG. AGAMENON MAGALHAES MELO, AO LADO DA PONTE JOSE DE BARROS LIMA",
        "AV. GOV. AGAMENON MAGALHAES, ENTRE O N. 4779 E 4575",
        "AV AGAMENON MAGALHAES EM FRENTE AO NR 1114 SENTIDO OLINDA/BOA VIAGEM",
        "GOVERNADOR AGAMENON MAGALHAES, SOB O SEMAFORO N. 659",
        "AVENIDA GOV. AGAMENON MAGALHAES, SOB AO SEMAFORO N. 037 SENTIDO BIA VIAGEM",
    ]

    for case in test_cases:
        compare_single(case, index, streets, street_tokens, semaphores)

    print("Comandos disponíveis:")
    print("  --filter KEYWORD   mostra análise para todas as ocorrências de KEYWORD")
    print("  --ties             scan completo do dataset (empates + mismatches)")
    print("  --raw \"STRING\"     testa uma localização específica")


if __name__ == "__main__":
    main()
