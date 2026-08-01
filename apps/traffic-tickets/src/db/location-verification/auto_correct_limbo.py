#!/usr/bin/env python3
"""
Auto-corrige locations em limbo extraindo a rua do raw_description.
Uso seguro: execute com --dry-run primeiro para preview.
"""

import argparse
import sqlite3
import time
import unicodedata
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DB = SCRIPT_DIR / "verification.db"


def normalize(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def extract_street_hint(raw):
    """Extrai o nome provavel da rua a partir do raw_description.
    Retorna (hint_normalizado, hint_pre_prefixo)."""
    raw_upper = raw.upper().strip()

    hint = None

    if "," in raw:
        hint = raw.split(",")[0].strip()
    elif "SEMAFORO" in raw_upper:
        hint = raw_upper.split("SEMAFORO")[0].strip()
    elif "POSTE" in raw_upper:
        hint = raw_upper.split("POSTE")[0].strip()
    elif "SOB AO" in raw_upper:
        hint = raw_upper.split("SOB AO")[0].strip()
    elif "SOB O" in raw_upper:
        hint = raw_upper.split("SOB O")[0].strip()
    elif "EM FRENTE" in raw_upper:
        hint = raw_upper.split("EM FRENTE")[0].strip()
    elif "ENTRE OS" in raw_upper:
        hint = raw_upper.split("ENTRE OS")[0].strip()
    else:
        hint = raw_upper

    # Guarda versao antes de remover prefixos
    pre_prefix = hint.strip()

    # Remove prefixos comuns (tamanho decrescente)
    prefixos = [
        "AVENIDA ", "AV. ", "AV ",
        "TRAVESSA ", "TRAV. ", "TRAV ",
        "ESTRADA ", "ENTRADA ",
        "RUA ", "PRACA ", "PRC. ", "PRC ",
        "PONTE ", "PTE. ", "PTE ",
        "VIADUTO ", "CAIS ", "PRAIA ", "RIO ",
        "1A. ", "1A ", "1A ",
        "C. ", "C ",
        "DR. ", "DR ", "DOUTOR ",
        "GAL ", "GAL. ",
        "PROF ", "PROF. ", "PROFESSOR ",
        "ENG ", "ENG. ", "ENGENHEIRO ",
        "PRACA PROFESSOR ", "PRACA PROF. ",
        "PRACA GENERAL ", "PRACA GAL. ",
    ]
    hint_upper = hint.upper()
    for prefix in sorted(set(prefixos), key=lambda x: len(x), reverse=True):
        if hint_upper.startswith(prefix.upper()):
            hint = hint[len(prefix):]
            break

    # Remove sufixos comuns do fim (antes da virgula/semaforo)
    sufixos_upper = [
        " SOB O ", " SOB AO ", " SOB ", " REF ", " SENTIDO ",
        " NR ", " N. ", " N ",
        " EM FRENTE AO ", " EM FRENTE A ",
        " LADO OPOSTO AO ", " LADO OPOSTO A ",
        " ENTRE OS ",
        " NO CRUZAMENTO",
    ]
    hint_upper2 = hint.upper()
    for suffix in sorted(sufixos_upper, key=lambda x: len(x), reverse=True):
        idx = hint_upper2.find(suffix)
        if idx > 0:
            hint = hint[:idx]
            break

    hint = normalize(hint)
    hint = hint.strip(".,;-: \t")
    words = hint.split()
    while words and len(words[-1]) <= 1:
        words.pop()
    hint = " ".join(words)

    pre_prefix = normalize(pre_prefix)
    pre_prefix = pre_prefix.strip(".,;-: \t")

    return hint, pre_prefix


def build_street_index(streets_by_code):
    """Pre-computa formas normalizadas e indice invertido por palavra."""
    index = []
    word_map = {}
    for code, s in streets_by_code.items():
        name_norm = normalize(s["official_name"])
        search_words = set(s["search"].split())
        entry = {
            "code": code,
            "name": s["official_name"],
            "search": s["search"],
            "name_norm": name_norm,
            "search_words": search_words,
        }
        index.append(entry)
        for w in search_words:
            if len(w) >= 3:
                word_map.setdefault(w, []).append(len(index) - 1)
        for w in name_norm.split():
            if len(w) >= 3:
                word_map.setdefault(w, []).append(len(index) - 1)
    return index, word_map


def search_streets(hint, streets_index, word_map, pre_prefix=""):
    """Busca a rua no dicionario. Retorna (code, name, confidence)."""
    if len(hint) < 3:
        return None, None, 0

    hint_words = [w for w in hint.split() if len(w) >= 2]
    if not hint_words:
        return None, None, 0

    candidates_seen = set()
    candidates = []

    def score_candidate(entry):
        search_field = entry["search"]
        name_norm = entry["name_norm"]
        score = 0

        if hint == search_field or hint == name_norm:
            score = 200
        elif hint in search_field:
            score = 150
        elif hint in name_norm:
            score = 140

        if not score:
            search_words_set = entry["search_words"]
            hint_set = set(hint_words)
            if hint_set.issubset(search_words_set) or all(w in search_field for w in hint_words):
                score = 120
            elif sum(1 for w in hint_words if w in search_field) >= max(2, len(hint_words) * 0.7):
                score = 100

        if not score:
            long_words = [w for w in hint_words if len(w) >= 4]
            if long_words:
                matched = sum(1 for w in long_words if w in search_field)
                if matched >= len(long_words) * 0.7:
                    score = 70
                elif matched >= 1:
                    score = 50

        return score

    # Busca via indice de palavras
    candidate_idxs = set()
    for w in hint_words:
        if len(w) >= 3 and w in word_map:
            for idx in word_map[w]:
                candidate_idxs.add(idx)

    # Adiciona candidatos via pre_prefix
    if len(hint) <= 5 and pre_prefix and pre_prefix != hint:
        pp_words = [w for w in pre_prefix.split() if len(w) >= 2]
        for w in pp_words:
            if len(w) >= 3 and w in word_map:
                for idx in word_map[w]:
                    candidate_idxs.add(idx)

    # Score cada candidato
    for idx in candidate_idxs:
        if idx in candidates_seen:
            continue
        candidates_seen.add(idx)
        entry = streets_index[idx]
        score = score_candidate(entry)

        # Bonus: nome oficial comeca com o hint ou pre_prefix
        if score > 0 and entry["name_norm"].startswith(hint):
            score += 10
        if score > 0 and pre_prefix and entry["name_norm"].startswith(pre_prefix):
            score += 15

        if score > 0:
            candidates.append({
                "code": entry["code"],
                "name": entry["name"],
                "score": score,
                "name_len": len(entry["name_norm"]),
            })

    # Fallback com pre_prefix se o hint puro nao achou nada
    if not candidates and pre_prefix and len(pre_prefix) >= 3:
        pp_words = [w for w in pre_prefix.split() if len(w) >= 2]
        for idx in candidate_idxs:
            if idx in candidates_seen:
                continue
            candidates_seen.add(idx)
            entry = streets_index[idx]

            if pre_prefix in entry["search"]:
                score = 170
            elif pre_prefix in entry["name_norm"]:
                score = 160
            elif all(w in entry["search"] for w in pp_words):
                score = 130
            elif sum(1 for w in pp_words if w in entry["search"]) >= max(2, len(pp_words) * 0.7):
                score = 110
            else:
                score = 0

            if score > 0:
                if entry["name_norm"].startswith(pre_prefix):
                    score += 15
                candidates.append({
                    "code": entry["code"],
                    "name": entry["name"],
                    "score": score,
                    "name_len": len(entry["name_norm"]),
                })

    if not candidates:
        return None, None, 0

    candidates.sort(key=lambda c: (c["score"], -c["name_len"]), reverse=True)
    best = candidates[0]

    score = best["score"]
    if score >= 200:
        confidence = 98
    elif score >= 150:
        confidence = 95
    elif score >= 120:
        confidence = 85
    elif score >= 100:
        confidence = 80
    elif score >= 70:
        confidence = 70
    elif score >= 60:
        confidence = 65
    elif score >= 50:
        if sum(1 for c in candidates if c["score"] == score) > 1:
            confidence = 50
        else:
            confidence = 55
    else:
        confidence = 40

    return best["code"], best["name"], confidence


def main():
    parser = argparse.ArgumentParser(description="Auto-corrige limbo extraindo rua do raw_description")
    parser.add_argument("--db", type=str, default=str(DEFAULT_DB), help="Caminho do banco")
    parser.add_argument("--dry-run", action="store_true", help="Apenas preview, nao modifica o banco")
    parser.add_argument("--type", type=str, default="", choices=["", "semaphore", "post", "normal"], help="Filtrar por tipo de location")
    parser.add_argument("--min-confidence", type=int, default=70, help="Confianca minima (0-100)")
    parser.add_argument("--limit", type=int, default=0, help="Max de correcoes (0=sem limite)")
    parser.add_argument("--street-code", type=str, default="", help="Filtrar por codigo de rua especifico")
    parser.add_argument("-y", "--yes", action="store_true", help="Nao pedir confirmacao")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"ERRO: banco nao encontrado: {db_path}")
        return 1

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    rows = conn.execute("SELECT code, official_name, short_name, concat_name, search FROM streets").fetchall()
    streets_by_code = {}
    for r in rows:
        streets_by_code[r["code"]] = {
            "code": r["code"],
            "official_name": r["official_name"],
            "short_name": r["short_name"],
            "concat_name": r["concat_name"],
            "search": r["search"],
        }
    print(f"{len(streets_by_code):,} ruas carregadas", flush=True)
    streets_index, word_map = build_street_index(streets_by_code)
    print(f"  indice: {len(word_map):,} palavras unicas", flush=True)

    conditions = ["vr.verified = 'limbo'"]
    cond_params = []

    if args.type:
        conditions.append("l.location_type = ?")
        cond_params.append(args.type)

    if args.street_code:
        conditions.append("l.street_code = ?")
        cond_params.append(args.street_code)

    where = " AND ".join(conditions)

    rows = conn.execute(f"""
        SELECT l.*, vr.verified, vr.notes
        FROM locations l
        JOIN verification_results vr ON l.location_id = vr.location_id
        WHERE {where}
        ORDER BY l.violation_count DESC
    """, cond_params).fetchall()

    print(f"{len(rows):,} locais em limbo encontrados", flush=True)

    results = {"high": [], "low": [], "no_match": []}
    to_correct = []

    for row in rows:
        raw = row["raw_description"]
        hint, pre_hint = extract_street_hint(raw)

        if len(hint) < 3:
            results["no_match"].append({
                "location_id": row["location_id"],
                "raw": raw,
                "hint": hint,
                "extracted": row["extracted_street"],
                "violations": row["violation_count"],
            })
            continue

        code, name, confidence = search_streets(hint, streets_index, word_map, pre_hint)

        entry = {
            "location_id": row["location_id"],
            "raw": raw,
            "hint": hint,
            "extracted": row["extracted_street"],
            "corrected_code": code,
            "corrected_name": name,
            "confidence": confidence,
            "violations": row["violation_count"],
        }

        if code and confidence >= args.min_confidence:
            results["high"].append(entry)
            to_correct.append({
                "location_id": row["location_id"],
                "corrected_street": name,
                "corrected_code": code,
            })
            if args.limit and len(to_correct) >= args.limit:
                break
        elif code and confidence > 0:
            results["low"].append(entry)
        else:
            results["no_match"].append(entry)

    print()
    print(f"{'='*80}")
    print(f"  Alta confianca (>= {args.min_confidence}): {len(results['high']):>6}")
    print(f"  Baixa confianca (< {args.min_confidence}):  {len(results['low']):>6}")
    print(f"  Sem match:                     {len(results['no_match']):>6}")
    print(f"  {'='*80}")

    if results["high"]:
        from collections import Counter
        types = Counter()
        total_vio = 0
        for r in results["high"]:
            total_vio += r["violations"]
        print(f"\n--- ALTA CONFIANCA: {len(results['high'])} correcoes ({total_vio:,} infracoes) ---")
        for r in results["high"][:30]:
            print(f"  #{r['location_id']:>8}  hint=[{r['hint'][:50]:<50}]  -> {r['corrected_name'][:45]:<45} [{r['corrected_code']}]  c={r['confidence']}")
        if len(results["high"]) > 30:
            print(f"  ... e mais {len(results['high']) - 30}")
        print()

    if results["low"]:
        print(f"--- BAIXA CONFIANCA: {len(results['low'])} ---")
        for r in results["low"][:20]:
            print(f"  #{r['location_id']:>8}  hint=[{r['hint'][:50]:<50}]  -> {r['corrected_name'][:45]:<45} [{r['corrected_code']}]  c={r['confidence']}")
        if len(results["low"]) > 20:
            print(f"  ... e mais {len(results['low']) - 20}")
        print()

    if results["no_match"]:
        print(f"--- SEM MATCH: {len(results['no_match'])} ---")
        for r in results["no_match"][:20]:
            print(f"  #{r['location_id']:>8}  hint=[{r['hint'][:50]:<50}]  raw=[{r['raw'][:80]}]")
        if len(results["no_match"]) > 20:
            print(f"  ... e mais {len(results['no_match']) - 20}")
        print()

    if args.dry_run:
        print(f"[DRY RUN] Nenhuma alteracao foi feita. {len(to_correct)} correcoes pendentes.")
        print("Execute sem --dry-run para aplicar.")
        conn.close()
        return 0

    if not to_correct:
        print("Nada a corrigir.")
        conn.close()
        return 0

    if not args.yes:
        resp = input(f"\nAplicar {len(to_correct)} correcoes? [s/N] ")
        if resp.lower() != "s":
            print("Cancelado.")
            conn.close()
            return 0

    timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
    applied = 0
    for item in to_correct:
        conn.execute("""
            INSERT OR REPLACE INTO verification_results
            (location_id, verified, corrected_street, corrected_street_code, notes, timestamp)
            VALUES (?, 'false', ?, ?, 'auto_correct', ?)
        """, (item["location_id"], item["corrected_street"], item["corrected_code"], timestamp))
        applied += 1
        if applied % 500 == 0:
            conn.commit()
            print(f"  {applied}/{len(to_correct)} aplicados...", flush=True)

    conn.commit()
    print(f"\n{applied} correcoes aplicadas.", flush=True)

    affected = set()
    for item in to_correct:
        row = conn.execute(
            "SELECT street_code FROM locations WHERE location_id = ?",
            (item["location_id"],),
        ).fetchone()
        if row and row["street_code"]:
            affected.add(row["street_code"])

    for sc in affected:
        row = conn.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN vr.verified = 'true' THEN 1 ELSE 0 END), 0) as verified,
                COALESCE(SUM(CASE WHEN vr.verified = 'false' THEN 1 ELSE 0 END), 0) as flagged,
                COALESCE(SUM(CASE WHEN vr.verified = 'limbo' THEN 1 ELSE 0 END), 0) as limbo
            FROM locations l
            LEFT JOIN verification_results vr ON l.location_id = vr.location_id
            WHERE l.street_code = ?
        """, (sc,)).fetchone()
        if row:
            conn.execute(
                "UPDATE street_summary SET verified = ?, flagged = ?, limbo = ? WHERE street_code = ?",
                (row["verified"], row["flagged"], row["limbo"], sc),
            )
    conn.commit()
    print(f"{len(affected)} resumos de rua atualizados.")

    conn.close()
    return 0


if __name__ == "__main__":
    exit(main())
