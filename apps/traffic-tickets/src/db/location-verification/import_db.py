#!/usr/bin/env python3
"""
Importa dados dos TSVs para um banco SQLite.

Uso: python import_db.py [--db caminho/db.sqlite]

Depois de rodar, o server.py consome o SQLite em vez dos TSVs em memoria.
"""

import csv
import re
import sqlite3
import sys
import time
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent.parent.parent.parent
SEED_DATA = ROOT / "packages" / "database" / "seed-data" / "traffic-tickets"
DATA_DIR = SEED_DATA
AUX_DIR = SEED_DATA / "auxiliary"
LOCATIONS_FILE = DATA_DIR / "location-descriptions.tsv"
COMPILED_FILE = DATA_DIR / "traffic-tickets-compiled.tsv"
STREETS_FILE = AUX_DIR / "logradouros-bairro.tsv"
RESULTS_FILE = SCRIPT_DIR / "results.tsv"
SEM_MAP_FILE = DATA_DIR / "semaphore-street-map.tsv"
POST_MAP_FILE = DATA_DIR / "post-street-map.tsv"
EQUIP_CORRECTIONS_FILE = SCRIPT_DIR / "equipment-corrections.tsv"

CHUNK = 50_000


def normalize(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def compute_location_type(semaphore_number):
    sn = (semaphore_number or "").strip()
    if not sn:
        return "normal"
    if sn.isdigit():
        return "semaphore"
    if sn[0].upper() in "BH":
        return "post"
    return "normal"


def create_schema(conn):
    conn.executescript("""
        CREATE TABLE locations (
            location_id    INTEGER PRIMARY KEY,
            raw_description TEXT NOT NULL,
            extracted_street TEXT,
            street_type     TEXT,
            street_code     TEXT,
            semaphore_number TEXT,
            address_number  TEXT,
            direction       TEXT,
            reference_point TEXT,
            violation_count INTEGER NOT NULL DEFAULT 0,
            location_type   TEXT NOT NULL DEFAULT 'normal',
            global_order    INTEGER NOT NULL
        ) WITHOUT ROWID;
        CREATE INDEX idx_loc_street_code  ON locations(street_code);
        CREATE INDEX idx_loc_global_order ON locations(global_order);
        CREATE INDEX idx_loc_type         ON locations(location_type);

        CREATE TABLE streets (
            code           TEXT PRIMARY KEY,
            official_name  TEXT,
            short_name     TEXT,
            concat_name    TEXT,
            search         TEXT
        ) WITHOUT ROWID;
        CREATE INDEX idx_streets_search ON streets(search);

        CREATE TABLE verification_results (
            location_id           INTEGER PRIMARY KEY,
            verified              TEXT,
            corrected_street      TEXT,
            corrected_street_code TEXT,
            notes                 TEXT,
            timestamp             TEXT
        ) WITHOUT ROWID;
        CREATE INDEX idx_vr_verified ON verification_results(verified);

        CREATE TABLE street_summary (
            street_code      TEXT PRIMARY KEY,
            extracted_name   TEXT,
            official_name    TEXT,
            total_locations  INTEGER NOT NULL DEFAULT 0,
            total_violations INTEGER NOT NULL DEFAULT 0,
            verified         INTEGER NOT NULL DEFAULT 0,
            flagged          INTEGER NOT NULL DEFAULT 0,
            limbo            INTEGER NOT NULL DEFAULT 0
        ) WITHOUT ROWID;

        CREATE TABLE semaphore_map (
            semaforo       TEXT NOT NULL,
            street_code    TEXT,
            street_name    TEXT,
            score          TEXT,
            raw_location   TEXT,
            location_index TEXT
        );

        CREATE TABLE post_map (
            post_code    TEXT NOT NULL,
            street_code  TEXT,
            street_name  TEXT,
            score        TEXT,
            raw_address  TEXT
        );

        CREATE TABLE equipment_corrections (
            equip_type      TEXT NOT NULL,
            equip_id        TEXT NOT NULL,
            location_index  TEXT NOT NULL DEFAULT '',
            corrected_code  TEXT,
            corrected_name  TEXT,
            notes           TEXT,
            timestamp       TEXT,
            verified        TEXT,
            PRIMARY KEY (equip_type, equip_id, location_index)
        ) WITHOUT ROWID;
    """)


def import_streets(conn):
    print(f"Cadastrando ruas de: {STREETS_FILE}", flush=True)
    rows = []
    with open(STREETS_FILE, "r") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            code = row.get("codlogradouro", "").strip()
            if not code or code == "0":
                continue
            official = row.get("nome_oficial_logradouro", "")
            short = row.get("nome_logradouro_resumido", "")
            concat = row.get("nome_logradouro_concatenado", "")
            rows.append((code, official, short, concat, normalize(official)))
    conn.executemany(
        "INSERT OR IGNORE INTO streets (code, official_name, short_name, concat_name, search) VALUES (?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    print(f"  {len(rows):,} ruas inseridas", flush=True)


def count_violations():
    print(f"Contando infracoes de: {COMPILED_FILE}", flush=True)
    counts = Counter()
    total = 0
    t0 = time.time()
    with open(COMPILED_FILE, "r") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            loc_id = row["location_id"]
            counts[loc_id] += 1
            total += 1
            if total % 2_000_000 == 0:
                elapsed = time.time() - t0
                print(f"  {total:,} linhas em {elapsed:.1f}s", flush=True)
    elapsed = time.time() - t0
    print(f"  Total: {total:,} linhas em {elapsed:.1f}s", flush=True)
    return counts


def import_locations(conn, counts):
    print(f"Importando locais de: {LOCATIONS_FILE}", flush=True)
    t0 = time.time()

    rows = []
    with open(LOCATIONS_FILE, "r") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            loc_id = row["location_id"]
            sc = row.get("street_code", "") or ""
            sn = row.get("semaphore_number", "") or ""
            rows.append((
                int(loc_id),
                row.get("raw_description", ""),
                row.get("extracted_street", ""),
                row.get("street_type", ""),
                sc,
                sn,
                row.get("address_number", ""),
                row.get("direction", ""),
                row.get("reference_point", ""),
                counts.get(loc_id, 0),
                compute_location_type(sn),
            ))

    rows.sort(key=lambda r: r[9], reverse=True)
    print(f"  {len(rows):,} locais lidos e ordenados em {time.time() - t0:.1f}s", flush=True)

    t0 = time.time()
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i : i + CHUNK]
        chunk_with_order = [(*r, i + j) for j, r in enumerate(chunk)]
        conn.executemany(
            "INSERT INTO locations (location_id, raw_description, extracted_street, street_type, street_code, semaphore_number, address_number, direction, reference_point, violation_count, location_type, global_order) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            chunk_with_order,
        )
        if (i + CHUNK) % (CHUNK * 10) == 0:
            print(f"  {i + CHUNK:,} / {len(rows):,}", flush=True)

    conn.commit()
    elapsed = time.time() - t0
    print(f"  {len(rows):,} locais inseridos em {elapsed:.1f}s", flush=True)


def build_street_summary(conn):
    print("Construindo resumo por rua...", flush=True)

    extracted_names = {}
    for row in conn.execute("SELECT DISTINCT street_code, extracted_street FROM locations WHERE street_code != ''"):
        sc = row["street_code"]
        if sc not in extracted_names:
            extracted_names[sc] = row["extracted_street"] or ""

    official_names = {}
    for row in conn.execute("SELECT code, official_name FROM streets"):
        official_names[row["code"]] = row["official_name"]

    rows = conn.execute("""
        SELECT l.street_code,
               COUNT(*) as total_loc,
               SUM(l.violation_count) as total_vio,
               SUM(CASE WHEN vr.verified = 'true' THEN 1 ELSE 0 END) as verified,
               SUM(CASE WHEN vr.verified = 'false' THEN 1 ELSE 0 END) as flagged,
               SUM(CASE WHEN vr.verified = 'limbo' THEN 1 ELSE 0 END) as limbo
        FROM locations l
        LEFT JOIN verification_results vr ON l.location_id = vr.location_id
        WHERE l.street_code != ''
        GROUP BY l.street_code
    """).fetchall()

    data = []
    for r in rows:
        sc = r["street_code"]
        data.append((
            sc,
            extracted_names.get(sc, ""),
            official_names.get(sc, ""),
            r["total_loc"],
            r["total_vio"],
            r["verified"],
            r["flagged"],
            r["limbo"],
        ))

    conn.executemany(
        "INSERT INTO street_summary (street_code, extracted_name, official_name, total_locations, total_violations, verified, flagged, limbo) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        data,
    )
    conn.commit()
    print(f"  {len(data):,} ruas resumidas", flush=True)


def import_equipment(conn):
    if SEM_MAP_FILE.exists():
        print(f"Importando mapa de semaforos: {SEM_MAP_FILE}", flush=True)
        rows = []
        with open(SEM_MAP_FILE, "r") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                rows.append((
                    row.get("semaforo", ""),
                    row.get("street_code", ""),
                    row.get("street_name", ""),
                    row.get("score", ""),
                    row.get("raw_location", ""),
                    row.get("location_index", ""),
                ))
        conn.executemany(
            "INSERT INTO semaphore_map (semaforo, street_code, street_name, score, raw_location, location_index) VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        print(f"  {len(rows):,} semaforos", flush=True)

    if POST_MAP_FILE.exists():
        print(f"Importando mapa de postes: {POST_MAP_FILE}", flush=True)
        rows = []
        with open(POST_MAP_FILE, "r") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                rows.append((
                    row.get("post_code", ""),
                    row.get("street_code", ""),
                    row.get("street_name", ""),
                    row.get("score", ""),
                    row.get("raw_address", ""),
                ))
        conn.executemany(
            "INSERT INTO post_map (post_code, street_code, street_name, score, raw_address) VALUES (?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        print(f"  {len(rows):,} postes", flush=True)


def import_corrections(conn):
    if EQUIP_CORRECTIONS_FILE.exists():
        print(f"Importando correcoes de equipamento: {EQUIP_CORRECTIONS_FILE}", flush=True)
        rows = []
        with open(EQUIP_CORRECTIONS_FILE, "r") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                rows.append((
                    row.get("equip_type", ""),
                    row.get("equip_id", ""),
                    row.get("location_index", ""),
                    row.get("corrected_code", ""),
                    row.get("corrected_name", ""),
                    row.get("notes", ""),
                    row.get("timestamp", ""),
                    row.get("verified", ""),
                ))
        conn.executemany(
            "INSERT OR REPLACE INTO equipment_corrections (equip_type, equip_id, location_index, corrected_code, corrected_name, notes, timestamp, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        print(f"  {len(rows):,} correcoes", flush=True)


def import_results(conn):
    if RESULTS_FILE.exists():
        print(f"Importando resultados existentes: {RESULTS_FILE}", flush=True)
        rows = []
        with open(RESULTS_FILE, "r") as f:
            reader = csv.DictReader(f, delimiter="\t")
            for row in reader:
                rows.append((
                    int(row["location_id"]),
                    row.get("verified", ""),
                    row.get("corrected_street", ""),
                    row.get("corrected_street_code", ""),
                    row.get("notes", ""),
                    row.get("timestamp", ""),
                ))
        conn.executemany(
            "INSERT OR REPLACE INTO verification_results (location_id, verified, corrected_street, corrected_street_code, notes, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            rows,
        )
        conn.commit()
        print(f"  {len(rows):,} resultados", flush=True)


def main():
    db_path = SCRIPT_DIR / "verification.db"
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--db" and i + 1 < len(args):
            db_path = Path(args[i + 1])
            i += 2
        else:
            print(f"Argumento desconhecido: {args[i]}")
            sys.exit(1)

    if db_path.exists():
        print(f"Removendo banco existente: {db_path}", flush=True)
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-200000")
    conn.execute("PRAGMA mmap_size=268435456")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA page_size=4096")

    print("Criando schema...", flush=True)
    create_schema(conn)

    import_streets(conn)
    counts = count_violations()
    import_locations(conn, counts)
    import_equipment(conn)
    import_corrections(conn)
    import_results(conn)
    build_street_summary(conn)

    conn.close()

    size_mb = db_path.stat().st_size / (1024 * 1024)
    print(f"\nBanco criado: {db_path} ({size_mb:.0f} MB)", flush=True)
    print("Pronto para usar com: python server.py [--db verification.db]", flush=True)


if __name__ == "__main__":
    main()
