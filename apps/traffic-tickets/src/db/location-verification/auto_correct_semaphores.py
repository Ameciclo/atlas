#!/usr/bin/env python3
"""
Auto-corrige locations de semaforos pendentes usando o semaphore-street-map.tsv.

Logica:
  Para cada location pendente com semaforo:
    1. Busca o semaforo no semaphore-street-map → ruas validas do cruzamento
    2. Extrai o hint do raw_description (mesma tecnica do auto_correct_limbo)
    3. Se o hint casa com OUTRA rua do cruzamento (nao a atual), corrige
    4. Se o hint nao casa com nenhuma rua do mapa, pula (ambiguo)

Uso seguro: execute com --dry-run primeiro.
"""

import argparse
import csv
import sqlite3
import time
import unicodedata
from collections import defaultdict
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent.parent.parent.parent
SEED_DATA = ROOT / "packages" / "database" / "seed-data" / "traffic-tickets"
DATA_DIR = SEED_DATA
DEFAULT_DB = SCRIPT_DIR / "verification.db"
SEM_MAP_FILE = DATA_DIR / "semaphore-street-map.tsv"


def normalize(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def load_semaphore_map():
    """Carrega o semaphore-street-map: semaforo → [(street_code, street_name_norm), ...]"""
    smap = defaultdict(list)
    with open(SEM_MAP_FILE, "r") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            sem_id = row["semaforo"].strip()
            code = row["street_code"].strip()
            name = row["street_name"].strip()
            if sem_id and code:
                smap[sem_id].append((code, normalize(name)))
    return smap


def extract_street_hint(raw):
    """Extrai o nome provavel da rua a partir do raw_description (mesma logica do auto_correct_limbo)."""
    raw_upper = raw.upper().strip()

    if "," in raw:
        hint = raw.split(",")[0].strip()
    elif "SEMAFORO" in raw_upper:
        hint = raw_upper.split("SEMAFORO")[0].strip()
    elif "SEMAF" in raw_upper:
        hint = raw_upper.split("SEMAF")[0].strip()
    elif "SEMF" in raw_upper:
        hint = raw_upper.split("SEMF")[0].strip()
    elif "POSTE" in raw_upper:
        hint = raw_upper.split("POSTE")[0].strip()
    elif "SOB AO" in raw_upper:
        hint = raw_upper.split("SOB AO")[0].strip()
    elif "SOB O" in raw_upper:
        hint = raw_upper.split("SOB O")[0].strip()
    elif "EM FRENTE" in raw_upper:
        hint = raw_upper.split("EM FRENTE")[0].strip()
    else:
        hint = raw_upper

    # Remove prefixos
    prefixos = [
        "AVENIDA ", "AV. ", "AV ",
        "TRAVESSA ", "TRAV. ", "TRAV ",
        "ESTRADA ", "ENTRADA ",
        "RUA ", "PRACA ", "PRC. ", "PRC ",
        "PONTE ", "PTE. ", "PTE ",
        "VIADUTO ", "CAIS ", "PRAIA ", "RIO ",
        "1A. ", "1A ",
        "C. ", "C ",
        "DR. ", "DR ", "DOUTOR ",
        "GAL ", "GAL. ",
        "PROF ", "PROF. ", "PROFESSOR ",
        "ENG ", "ENG. ", "ENGENHEIRO ",
    ]
    hint_upper = hint.upper()
    for prefix in sorted(set(prefixos), key=lambda x: len(x), reverse=True):
        if hint_upper.startswith(prefix.upper()):
            hint = hint[len(prefix):]
            break

    # Remove sufixos
    sufixos_upper = [
        " SOB O ", " SOB AO ", " SOB ", " REF ", " SENTIDO ",
        " NR ", " N. ", " N ",
        " EM FRENTE AO ", " EM FRENTE A ",
        " LADO OPOSTO AO ", " LADO OPOSTO A ",
        " ENTRE OS ", " NO CRUZAMENTO", " CRUZAMENTO",
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
    return " ".join(words)


def match_hint_to_map(hint, sem_map_entries):
    """Tenta casar o hint com uma das ruas do mapa do semaforo.
    Retorna (code, name_original, confidence)."""
    hint_words = [w for w in hint.split() if len(w) >= 2]
    if not hint_words:
        return None, None, 0

    best_code = None
    best_name = None
    best_confidence = 0

    for code, name_norm in sem_map_entries:
        confidence = 0

        if hint == name_norm:
            confidence = 100
        elif hint in name_norm and len(hint) >= 5:
            confidence = 95
        elif name_norm in hint and len(name_norm) >= 5:
            confidence = 90
        elif all(w in name_norm for w in hint_words) and len(hint_words) >= 2:
            confidence = 85
        elif sum(1 for w in hint_words if w in name_norm) >= max(2, len(hint_words) * 0.7):
            confidence = 75
        elif len(hint_words) >= 2 and hint_words[0] in name_norm and hint_words[-1] in name_norm:
            confidence = 70
        elif hint_words[0] in name_norm and len(hint_words[0]) >= 4:
            confidence = 60

        if confidence > best_confidence:
            best_confidence = confidence
            best_code = code
            best_name = name_norm

    return best_code, best_name, best_confidence


def main():
    parser = argparse.ArgumentParser(description="Auto-corrige semaforos pendentes usando semaphore-street-map")
    parser.add_argument("--db", type=str, default=str(DEFAULT_DB), help="Caminho do banco")
    parser.add_argument("--dry-run", action="store_true", help="Apenas preview, nao modifica o banco")
    parser.add_argument("--min-confidence", type=int, default=70, help="Confianca minima (0-100)")
    parser.add_argument("--limit", type=int, default=0, help="Max de correcoes (0=sem limite)")
    parser.add_argument("--street-code", type=str, default="", help="Filtrar por codigo de rua")
    parser.add_argument("-y", "--yes", action="store_true", help="Nao pedir confirmacao")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"ERRO: banco nao encontrado: {db_path}")
        return 1

    if not SEM_MAP_FILE.exists():
        print(f"ERRO: semaphore-street-map nao encontrado: {SEM_MAP_FILE}")
        return 1

    print(f"Carregando semaphore-street-map: {SEM_MAP_FILE}", flush=True)
    smap = load_semaphore_map()
    print(f"  {len(smap):,} semaforos carregados", flush=True)

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    conditions = ["l.location_type = 'semaphore'",
                  "(vr.verified IS NULL OR vr.verified = '')"]
    cond_params = []

    if args.street_code:
        conditions.append("l.street_code = ?")
        cond_params.append(args.street_code)

    where = " AND ".join(conditions)

    rows = conn.execute(f"""
        SELECT l.*, vr.verified
        FROM locations l
        LEFT JOIN verification_results vr ON l.location_id = vr.location_id
        WHERE {where}
        ORDER BY l.violation_count DESC
    """, cond_params).fetchall()

    print(f"{len(rows):,} semaforos pendentes encontrados", flush=True)

    results = {"high": [], "low": [], "skip": []}
    to_correct = []

    for row in rows:
        sem_id = (row["semaphore_number"] or "").strip()
        if not sem_id or sem_id not in smap:
            continue

        sem_entries = smap[sem_id]
        current_code = (row["street_code"] or "").strip()
        raw = row["raw_description"] or ""
        hint = extract_street_hint(raw)

        if len(hint) < 3:
            continue

        code, name, confidence = match_hint_to_map(hint, sem_entries)

        entry = {
            "location_id": row["location_id"],
            "semaphore": sem_id,
            "raw": raw,
            "hint": hint,
            "current_code": current_code,
            "matched_code": code,
            "matched_name": name,
            "confidence": confidence,
            "violations": row["violation_count"],
        }

        if not code:
            entry["reason"] = "hint_nao_bate_com_nenhuma_rua_do_mapa"
            results["skip"].append(entry)
            continue

        if code == current_code:
            entry["reason"] = "ja_esta_na_rua_correta"
            results["skip"].append(entry)
            continue

        if confidence >= args.min_confidence:
            results["high"].append(entry)
            to_correct.append({
                "location_id": row["location_id"],
                "corrected_street": entry["matched_name"],
                "corrected_code": code,
            })
            if args.limit and len(to_correct) >= args.limit:
                break
        elif confidence > 0:
            results["low"].append(entry)
        else:
            results["skip"].append(entry)

    print()
    print(f"{'='*80}")
    print(f"  Alta confianca (>= {args.min_confidence}): {len(results['high']):>6}")
    print(f"  Baixa confianca (< {args.min_confidence}):  {len(results['low']):>6}")
    print(f"  Pulados (ja certo / ambiguo):       {len(results['skip']):>6}")
    print(f"  {'='*80}")

    if results["high"]:
        total_vio = sum(r["violations"] for r in results["high"])
        print(f"\n--- ALTA CONFIANCA: {len(results['high'])} correcoes ({total_vio:,} infracoes) ---")
        for r in results["high"][:30]:
            print(f"  #{r['location_id']:>8}  sem={r['semaphore']:>4s}  hint=[{r['hint'][:45]:<45}]  {r['current_code']} -> {r['matched_code']}  c={r['confidence']}")
        if len(results["high"]) > 30:
            print(f"  ... e mais {len(results['high']) - 30}")
        print()

    if results["low"]:
        print(f"--- BAIXA CONFIANCA: {len(results['low'])} ---")
        for r in results["low"][:15]:
            print(f"  #{r['location_id']:>8}  sem={r['semaphore']:>4s}  hint=[{r['hint'][:45]:<45}]  {r['current_code']} -> {r['matched_code']}  c={r['confidence']}")
        if len(results["low"]) > 15:
            print(f"  ... e mais {len(results['low']) - 15}")
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
            VALUES (?, 'false', ?, ?, 'auto_semaphore', ?)
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
