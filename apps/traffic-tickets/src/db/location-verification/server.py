#!/usr/bin/env python3
"""
Servidor de verificacao de matches de enderecos do traffic-tickets.

Abordagem hibrida: ruas e indices em memoria (~2 MB), locations no SQLite.
Execute import_db.py primeiro para criar o banco.
"""

import csv
import json
import re
import sqlite3
import sys
import time
import threading
import unicodedata
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs

SCRIPT_DIR = Path(__file__).resolve().parent
INDEX_FILE = SCRIPT_DIR / "index.html"
STREETS_FILE_HTML = SCRIPT_DIR / "streets.html"
EQUIPMENT_FILE_HTML = SCRIPT_DIR / "equipment.html"
LIMBO_FILE_HTML = SCRIPT_DIR / "limbo.html"
DEFAULT_DB = SCRIPT_DIR / "verification.db"
RESULTS_FILE = SCRIPT_DIR / "results.tsv"
EQUIP_CORRECTIONS_FILE = SCRIPT_DIR / "equipment-corrections.tsv"


def normalize(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return s.lower().strip()


def get_db(path):
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA cache_size=-200000")
    conn.execute("PRAGMA mmap_size=268435456")
    conn.execute("PRAGMA temp_store=MEMORY")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


class Handler(BaseHTTPRequestHandler):
    db_path = None
    db = None
    db_lock = threading.Lock()

    streets = None
    streets_by_code = None
    max_index = 0

    @classmethod
    def init_data(cls):
        if cls.db_path is None:
            cls.db_path = DEFAULT_DB
        if cls.db is None:
            cls.db = get_db(cls.db_path)
        if cls.streets is None:
            cls._load_streets()
            cls._load_max_index()

    @classmethod
    def _load_streets(cls):
        rows = cls.db.execute("SELECT code, official_name, short_name, concat_name, search FROM streets").fetchall()
        cls.streets = []
        cls.streets_by_code = {}
        for r in rows:
            s = {
                "code": r["code"],
                "official_name": r["official_name"],
                "short_name": r["short_name"],
                "concat_name": r["concat_name"],
                "search": r["search"],
            }
            cls.streets.append(s)
            cls.streets_by_code[r["code"]] = s
        print(f"  {len(cls.streets):,} ruas carregadas em memoria", flush=True)

    @classmethod
    def _load_max_index(cls):
        row = cls.db.execute("SELECT MAX(global_order) as m FROM locations").fetchone()
        cls.max_index = row["m"] if row and row["m"] is not None else 0

    @classmethod
    def set_db_path(cls, path):
        cls.db_path = path

    @classmethod
    def _refresh_street_summary(cls, street_codes):
        db = cls.db
        for sc in street_codes:
            row = db.execute("""
                SELECT
                    COALESCE(SUM(CASE WHEN vr.verified = 'true' THEN 1 ELSE 0 END), 0) as verified,
                    COALESCE(SUM(CASE WHEN vr.verified = 'false' THEN 1 ELSE 0 END), 0) as flagged,
                    COALESCE(SUM(CASE WHEN vr.verified = 'limbo' THEN 1 ELSE 0 END), 0) as limbo
                FROM locations l
                LEFT JOIN verification_results vr ON l.location_id = vr.location_id
                WHERE l.street_code = ?
            """, (sc,)).fetchone()
            if row:
                db.execute(
                    "UPDATE street_summary SET verified = ?, flagged = ?, limbo = ? WHERE street_code = ?",
                    (row["verified"], row["flagged"], row["limbo"], sc),
                )
        db.commit()

    def log_message(self, format, *args):
        print(f"{self.address_string()} - {format % args}", flush=True)

    # ------------------------------------------------------------------ helpers

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, path):
        if not path.exists():
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not found")
            return
        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def _get_bool_param(self, params, name):
        val = params.get(name, ["0"])[0]
        return val in ("1", "true", "True")

    def _row_to_location(self, row):
        if row is None:
            return None
        d = dict(row)
        d["_index"] = d.get("global_order", 0)
        d["_location_type"] = d.get("location_type", "normal")
        return d

    @staticmethod
    def _translate_status(status_str):
        mapping = {"pending": "", "verified": "true", "corrected": "false", "limbo": "limbo"}
        result = set()
        for s in status_str.split(","):
            s = s.strip()
            if s in mapping:
                result.add(mapping[s])
        return result

    # ------------------------------------------------------------------ GET

    def do_GET(self):
        self.init_data()
        parsed = urlparse(self.path)
        path = parsed.path
        db = self.db
        params = parse_qs(parsed.query)

        if path == "/":
            self._send_html(INDEX_FILE)
            return

        if path == "/streets":
            self._send_html(STREETS_FILE_HTML)
            return

        if path == "/equipment":
            self._send_html(EQUIPMENT_FILE_HTML)
            return

        if path == "/limbo":
            self._send_html(LIMBO_FILE_HTML)
            return

        if path == "/api/progress":
            row = db.execute("""
                SELECT
                    (SELECT COUNT(*) FROM locations) as total,
                    (SELECT COUNT(*) FROM verification_results WHERE verified = 'true') as verified,
                    (SELECT COUNT(*) FROM verification_results WHERE verified = 'false') as flagged,
                    (SELECT COUNT(*) FROM verification_results WHERE verified = 'limbo') as limbo,
                    (SELECT COUNT(*) FROM locations WHERE violation_count > 0) as nonzero,
                    (SELECT COUNT(*) FROM locations WHERE violation_count = 0) as zero
            """).fetchone()
            total = row["total"]
            verified = row["verified"]
            flagged = row["flagged"]
            limbo = row["limbo"]
            remaining = total - verified - flagged - limbo
            self._send_json({
                "total": total,
                "nonzero_violations": row["nonzero"],
                "zero_violations": row["zero"],
                "verified": verified,
                "flagged": flagged,
                "limbo": limbo,
                "remaining": remaining,
            })
            return

        if path == "/api/location":
            index = int(params.get("index", [0])[0])
            index = max(0, min(index, self.max_index))
            row = db.execute("""
                SELECT l.*, vr.verified, vr.corrected_street, vr.corrected_street_code, vr.notes
                FROM locations l
                LEFT JOIN verification_results vr ON l.location_id = vr.location_id
                WHERE l.global_order = ?
                LIMIT 1
            """, (index,)).fetchone()
            if row is None:
                self._send_json({})
                return
            self._send_json(self._row_to_location(row))
            return

        if path == "/api/navigate":
            from_idx = int(params.get("from", ["0"])[0])
            direction = int(params.get("dir", ["1"])[0])

            filt_unverified = self._get_bool_param(params, "unverified")
            filt_flagged = self._get_bool_param(params, "flagged")
            filt_verified = self._get_bool_param(params, "verified")
            filt_limbo = self._get_bool_param(params, "limbo")
            filt_nonzero = self._get_bool_param(params, "nonzero")
            filt_zero = self._get_bool_param(params, "zero")
            filt_hide_sempost = self._get_bool_param(params, "hidesempost")

            conditions = []
            cond_params = []

            if filt_unverified:
                conditions.append("(vr.verified IS NULL OR vr.verified = '')")
            if filt_flagged:
                conditions.append("vr.verified = 'false'")
            if filt_verified:
                conditions.append("vr.verified = 'true'")
            if filt_limbo:
                conditions.append("vr.verified = 'limbo'")
            if filt_nonzero:
                conditions.append("l.violation_count > 0")
            if filt_zero:
                conditions.append("l.violation_count = 0")
            if filt_hide_sempost:
                conditions.append("l.location_type NOT IN ('semaphore', 'post')")

            where = " AND ".join(conditions) if conditions else "1=1"

            if direction >= 0:
                sql = f"""
                    SELECT l.*, vr.verified, vr.corrected_street, vr.corrected_street_code, vr.notes
                    FROM locations l
                    LEFT JOIN verification_results vr ON l.location_id = vr.location_id
                    WHERE l.global_order >= ? AND ({where})
                    ORDER BY l.global_order ASC
                    LIMIT 1
                """
                cond_params.insert(0, from_idx)
            else:
                sql = f"""
                    SELECT l.*, vr.verified, vr.corrected_street, vr.corrected_street_code, vr.notes
                    FROM locations l
                    LEFT JOIN verification_results vr ON l.location_id = vr.location_id
                    WHERE l.global_order < ? AND ({where})
                    ORDER BY l.global_order DESC
                    LIMIT 1
                """
                cond_params.insert(0, from_idx)

            row = db.execute(sql, cond_params).fetchone()
            if row is None:
                self._send_json({"found": False, "index": from_idx})
                return
            self._send_json(self._row_to_location(row))
            return

        if path == "/api/equipment/semaphores":
            rows = db.execute("""
                SELECT sm.*,
                       COALESCE(vio.total, 0) as violations,
                       ec.corrected_code, ec.corrected_name, ec.notes,
                       ec.verified as corr_verified
                FROM semaphore_map sm
                LEFT JOIN (
                    SELECT semaphore_number, SUM(violation_count) as total
                    FROM locations
                    WHERE location_type = 'semaphore'
                    GROUP BY semaphore_number
                ) vio ON sm.semaforo = vio.semaphore_number
                LEFT JOIN equipment_corrections ec
                    ON ec.equip_type = 'sem' AND ec.equip_id = sm.semaforo
                    AND ec.location_index = sm.location_index
                ORDER BY violations DESC
            """).fetchall()
            entries = []
            for r in rows:
                cc = r["corrected_code"] or ""
                cn = r["corrected_name"] or ""
                entries.append({
                    "semaforo": r["semaforo"],
                    "street_code": r["street_code"],
                    "street_name": r["street_name"],
                    "score": r["score"],
                    "raw_location": r["raw_location"] or "",
                    "location_index": r["location_index"] or "",
                    "violations": r["violations"],
                    "corrected_code": cc,
                    "corrected_name": cn,
                    "notes": r["notes"] or "",
                    "verified": r["corr_verified"] or "",
                    "effective_street_code": cc or r["street_code"],
                    "effective_street_name": cn or r["street_name"],
                })
            self._send_json(entries)
            return

        if path == "/api/equipment/posts":
            rows = db.execute("""
                SELECT pm.*,
                       COALESCE(vio.total, 0) as violations,
                       ec.corrected_code, ec.corrected_name, ec.notes,
                       ec.verified as corr_verified
                FROM post_map pm
                LEFT JOIN (
                    SELECT UPPER(semaphore_number) as code, SUM(violation_count) as total
                    FROM locations
                    WHERE location_type = 'post'
                    GROUP BY UPPER(semaphore_number)
                ) vio ON pm.post_code = vio.code
                LEFT JOIN equipment_corrections ec
                    ON ec.equip_type = 'post' AND ec.equip_id = pm.post_code
                    AND ec.location_index = ''
                ORDER BY violations DESC
            """).fetchall()
            entries = []
            for r in rows:
                cc = r["corrected_code"] or ""
                cn = r["corrected_name"] or ""
                entries.append({
                    "post_code": r["post_code"],
                    "street_code": r["street_code"],
                    "street_name": r["street_name"],
                    "score": r["score"],
                    "raw_address": r["raw_address"] or "",
                    "violations": r["violations"],
                    "corrected_code": cc,
                    "corrected_name": cn,
                    "notes": r["notes"] or "",
                    "verified": r["corr_verified"] or "",
                    "effective_street_code": cc or r["street_code"],
                    "effective_street_name": cn or r["street_name"],
                })
            self._send_json(entries)
            return

        if path == "/api/streets/search":
            q = normalize(params.get("q", [""])[0])
            q = re.sub(r"['\-\.,;:\"/]", " ", q)
            q = re.sub(r"\s+", " ", q).strip()
            results = []
            if q and len(q) >= 2:
                for s in self.streets:
                    if q in s["search"]:
                        results.append({
                            "code": s["code"],
                            "official_name": s["official_name"],
                            "short_name": s["short_name"],
                        })
                        if len(results) >= 20:
                            break
            self._send_json(results)
            return

        if path == "/api/street-summary":
            rows = db.execute("""
                SELECT * FROM street_summary
                ORDER BY total_violations DESC
            """).fetchall()

            summary = []
            total_reviewed = 0
            total_corrected = 0
            total_limbo = 0
            streets_reviewed = 0

            for r in rows:
                verified = r["verified"]
                flagged = r["flagged"]
                limbo = r["limbo"]
                total_loc = r["total_locations"]
                if verified + flagged + limbo > 0:
                    streets_reviewed += 1
                total_reviewed += verified + flagged + limbo
                total_corrected += flagged
                total_limbo += limbo
                summary.append({
                    "street_code": r["street_code"],
                    "extracted_name": r["extracted_name"],
                    "official_name": r["official_name"],
                    "total_locations": total_loc,
                    "total_violations": r["total_violations"],
                    "verified": verified,
                    "flagged": flagged,
                    "limbo": limbo,
                    "unverified": total_loc - verified - flagged - limbo,
                })

            total_loc = db.execute("SELECT COUNT(*) as c FROM locations").fetchone()["c"]
            total_streets = len(rows)
            self._send_json({
                "streets": summary,
                "totals": {
                    "total_locations": total_loc,
                    "total_reviewed": total_reviewed,
                    "total_corrected": total_corrected,
                    "total_limbo": total_limbo,
                    "total_streets": total_streets,
                    "total_streets_reviewed": streets_reviewed,
                },
            })
            return

        if path == "/api/street-locations":
            sc = params.get("code", [""])[0]
            if not sc:
                self._send_json([])
                return

            hide_equip = self._get_bool_param(params, "hide_equip")
            equip_type = params.get("equip_type", [""])[0]
            status = params.get("status", [""])[0]
            active_statuses = self._translate_status(status)

            rows = db.execute("""
                SELECT l.*, vr.verified, vr.corrected_street, vr.corrected_street_code, vr.notes
                FROM locations l
                LEFT JOIN verification_results vr ON l.location_id = vr.location_id
                WHERE l.street_code = ?
                ORDER BY l.global_order
            """, (sc,)).fetchall()

            locations = []
            for row in rows:
                d = dict(row)
                lt = d.get("location_type", "normal")
                d["_location_type"] = lt
                if hide_equip and lt in ("semaphore", "post"):
                    continue
                if equip_type == "equipment" and lt not in ("semaphore", "post"):
                    continue
                if equip_type and equip_type != "equipment" and lt != equip_type:
                    continue
                if active_statuses:
                    effective = d.get("verified") or ""
                    if effective not in active_statuses:
                        continue
                d["_index"] = d.get("global_order", 0)
                locations.append(d)
            self._send_json(locations)
            return

        if path == "/api/export":
            self._send_json({"error": "use results.tsv file directly"})
            return

        if path == "/api/limbo-locations":
            sort = params.get("sort", ["vio"])[0]
            dir_order = params.get("dir", ["desc"])[0]
            search = params.get("search", [""])[0].lower()
            equip_type = params.get("type", [""])[0]
            street_code = params.get("street_code", [""])[0]
            status_str = params.get("status", ["limbo"])[0]
            limit = int(params.get("limit", ["100"])[0])
            offset = int(params.get("offset", ["0"])[0])

            active_statuses = self._translate_status(status_str)

            conditions = []
            cond_params = []

            if active_statuses:
                # Filter by verified status
                status_ors = []
                for s in active_statuses:
                    if s == "":
                        status_ors.append("(vr.verified IS NULL OR vr.verified = '')")
                    else:
                        status_ors.append("vr.verified = ?")
                        cond_params.append(s)
                conditions.append("(" + " OR ".join(status_ors) + ")")
            else:
                conditions.append("vr.verified = 'limbo'")

            if search:
                conditions.append("LOWER(l.raw_description) LIKE ?")
                cond_params.append(f"%{search}%")

            if equip_type:
                conditions.append("l.location_type = ?")
                cond_params.append(equip_type)

            if street_code:
                conditions.append("l.street_code = ?")
                cond_params.append(street_code)

            where = " AND ".join(conditions)

            count_row = db.execute(f"""
                SELECT COUNT(*) as c, COALESCE(SUM(l.violation_count), 0) as v
                FROM locations l
                JOIN verification_results vr ON l.location_id = vr.location_id
                WHERE {where}
            """, cond_params).fetchone()

            sort_map = {
                "vio": "l.violation_count",
                "raw": "l.raw_description",
                "extracted": "l.extracted_street",
                "id": "l.location_id",
            }
            order_col = sort_map.get(sort, "l.violation_count")
            order_dir = "DESC" if dir_order == "desc" else "ASC"

            rows = db.execute(f"""
                SELECT l.*, vr.verified, vr.corrected_street, vr.corrected_street_code, vr.notes
                FROM locations l
                JOIN verification_results vr ON l.location_id = vr.location_id
                WHERE {where}
                ORDER BY {order_col} {order_dir}
                LIMIT ? OFFSET ?
            """, cond_params + [limit, offset]).fetchall()

            items = []
            for r in rows:
                d = dict(r)
                d["_index"] = d.get("global_order", 0)
                d["_location_type"] = d.get("location_type", "normal")
                items.append(d)

            self._send_json({
                "total": count_row["c"],
                "total_violations": count_row["v"] or 0,
                "items": items,
            })
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")

    # ------------------------------------------------------------------ POST

    def do_POST(self):
        self.init_data()
        parsed = urlparse(self.path)
        db = self.db

        if parsed.path == "/api/verify":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            location_id = int(data.get("location_id", "0"))
            verified = data.get("verified", "")
            corrected_street = data.get("corrected_street", "")
            corrected_street_code = data.get("corrected_street_code", "")
            notes = data.get("notes", "")
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

            with self.db_lock:
                db.execute("""
                    INSERT OR REPLACE INTO verification_results
                    (location_id, verified, corrected_street, corrected_street_code, notes, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (location_id, verified, corrected_street, corrected_street_code, notes, timestamp))

                sc_row = db.execute("SELECT street_code FROM locations WHERE location_id = ?", (location_id,)).fetchone()
                if sc_row and sc_row["street_code"]:
                    self._refresh_street_summary([sc_row["street_code"]])

            self._send_json({"status": "ok"})
            return

        if parsed.path == "/api/reset":
            with self.db_lock:
                affected = set()
                for r in db.execute("SELECT location_id FROM verification_results").fetchall():
                    row = db.execute("SELECT street_code FROM locations WHERE location_id = ?", (r["location_id"],)).fetchone()
                    if row and row["street_code"]:
                        affected.add(row["street_code"])
                db.execute("DELETE FROM verification_results")
                db.commit()
                self._refresh_street_summary(list(affected))
            self._send_json({"status": "ok"})
            return

        if parsed.path == "/api/equipment/correct":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            equip_type = data.get("equip_type", "")
            equip_id = data.get("equip_id", "")
            loc_index = data.get("location_index", "")
            corrected_code = data.get("corrected_code", "")
            corrected_name = data.get("corrected_name", "")
            notes = data.get("notes", "")
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

            with self.db_lock:
                db.execute("""
                    INSERT OR REPLACE INTO equipment_corrections
                    (equip_type, equip_id, location_index, corrected_code, corrected_name, notes, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (equip_type, equip_id, loc_index, corrected_code, corrected_name, notes, timestamp))
                db.commit()
            self._send_json({"status": "ok"})
            return

        if parsed.path == "/api/equipment/batch-correct":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            items = data.get("items", [])
            corrected_code = data.get("corrected_code", "")
            corrected_name = data.get("corrected_name", "")
            notes = data.get("notes", "")
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

            with self.db_lock:
                for item in items:
                    db.execute("""
                        INSERT OR REPLACE INTO equipment_corrections
                        (equip_type, equip_id, location_index, corrected_code, corrected_name, notes, timestamp)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (
                        item.get("equip_type", ""),
                        item.get("equip_id", ""),
                        item.get("location_index", ""),
                        corrected_code,
                        corrected_name,
                        notes,
                        timestamp,
                    ))
                db.commit()
            self._send_json({"status": "ok", "count": len(items)})
            return

        if parsed.path == "/api/equipment/mark-ok":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            equip_type = data.get("equip_type", "")
            equip_id = data.get("equip_id", "")
            loc_index = data.get("location_index", "")
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

            with self.db_lock:
                db.execute("""
                    INSERT INTO equipment_corrections (equip_type, equip_id, location_index, verified, timestamp)
                    VALUES (?, ?, ?, 'true', ?)
                    ON CONFLICT(equip_type, equip_id, location_index)
                    DO UPDATE SET verified = 'true', timestamp = ?
                """, (equip_type, equip_id, loc_index, timestamp, timestamp))
                db.commit()
            self._send_json({"status": "ok"})
            return

        if parsed.path == "/api/equipment/mark-ok-batch":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            items = data.get("items", [])
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

            with self.db_lock:
                for item in items:
                    et = item.get("equip_type", "")
                    ei = item.get("equip_id", "")
                    li = item.get("location_index", "")
                    db.execute("""
                        INSERT INTO equipment_corrections (equip_type, equip_id, location_index, verified, timestamp)
                        VALUES (?, ?, ?, 'true', ?)
                        ON CONFLICT(equip_type, equip_id, location_index)
                        DO UPDATE SET verified = 'true', timestamp = ?
                    """, (et, ei, li, timestamp, timestamp))
                db.commit()
            self._send_json({"status": "ok", "count": len(items)})
            return

        if parsed.path == "/api/streets/correct-batch":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            street_codes = data.get("street_codes", [])
            corrected_code = data.get("corrected_code", "")
            corrected_name = data.get("corrected_name", "")
            notes = data.get("notes", "")
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
            updated = 0

            with self.db_lock:
                for sc in street_codes:
                    cur = db.execute("""
                        INSERT INTO verification_results (location_id, verified, corrected_street, corrected_street_code, notes, timestamp)
                        SELECT l.location_id, 'false', ?, ?, ?, ?
                        FROM locations l
                        WHERE l.street_code = ?
                          AND l.location_id NOT IN (SELECT location_id FROM verification_results)
                    """, (corrected_name, corrected_code, notes, timestamp, sc))
                    updated += cur.rowcount
                db.commit()
                self._refresh_street_summary(street_codes)
            self._send_json({"status": "ok", "updated": updated})
            return

        if parsed.path == "/api/streets/ok-batch":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            street_codes = data.get("street_codes", [])
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
            updated = 0

            with self.db_lock:
                for sc in street_codes:
                    cur = db.execute("""
                        INSERT INTO verification_results (location_id, verified, corrected_street, corrected_street_code, notes, timestamp)
                        SELECT l.location_id, 'true', '', '', '', ?
                        FROM locations l
                        WHERE l.street_code = ?
                          AND l.location_id NOT IN (SELECT location_id FROM verification_results)
                    """, (timestamp, sc))
                    updated += cur.rowcount
                db.commit()
                self._refresh_street_summary(street_codes)
            self._send_json({"status": "ok", "updated": updated})
            return

        if parsed.path == "/api/unverify":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))
            location_id = int(data.get("location_id", 0))

            with self.db_lock:
                sc_row = db.execute("SELECT street_code FROM locations WHERE location_id = ?", (location_id,)).fetchone()
                db.execute("DELETE FROM verification_results WHERE location_id = ?", (location_id,))
                db.commit()
                if sc_row and sc_row["street_code"]:
                    self._refresh_street_summary([sc_row["street_code"]])
            self._send_json({"status": "ok"})
            return

        if parsed.path == "/api/streets/unverify-batch":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))
            street_codes = data.get("street_codes", [])
            updated = 0

            with self.db_lock:
                for sc in street_codes:
                    cur = db.execute("""
                        DELETE FROM verification_results
                        WHERE location_id IN (SELECT location_id FROM locations WHERE street_code = ?)
                    """, (sc,))
                    updated += cur.rowcount
                db.commit()
                self._refresh_street_summary(street_codes)
            self._send_json({"status": "ok", "updated": updated})
            return

        if parsed.path == "/api/limbo":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))
            location_id = int(data.get("location_id", "0"))
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")

            with self.db_lock:
                db.execute("""
                    INSERT OR REPLACE INTO verification_results
                    (location_id, verified, corrected_street, corrected_street_code, notes, timestamp)
                    VALUES (?, 'limbo', '', '', '', ?)
                """, (location_id, timestamp))
                sc_row = db.execute("SELECT street_code FROM locations WHERE location_id = ?", (location_id,)).fetchone()
                db.commit()
                if sc_row and sc_row["street_code"]:
                    self._refresh_street_summary([sc_row["street_code"]])
            self._send_json({"status": "ok"})
            return

        if parsed.path == "/api/streets/limbo-batch":
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))
            street_codes = data.get("street_codes", [])
            timestamp = time.strftime("%Y-%m-%dT%H:%M:%S")
            updated = 0

            with self.db_lock:
                for sc in street_codes:
                    cur = db.execute("""
                        INSERT INTO verification_results (location_id, verified, corrected_street, corrected_street_code, notes, timestamp)
                        SELECT l.location_id, 'limbo', '', '', '', ?
                        FROM locations l
                        WHERE l.street_code = ?
                          AND l.location_id NOT IN (SELECT location_id FROM verification_results)
                    """, (timestamp, sc))
                    updated += cur.rowcount
                db.commit()
                self._refresh_street_summary(street_codes)
            self._send_json({"status": "ok", "updated": updated})
            return

        self.send_response(404)
        self.end_headers()
        self.wfile.write(b"Not found")

    # ------------------------------------------------------------------ export helpers

    @classmethod
    def export_results_to_tsv(cls):
        if cls.db is None:
            cls.db = get_db(cls.db_path or DEFAULT_DB)
        db = cls.db
        rows = db.execute("SELECT * FROM verification_results ORDER BY location_id").fetchall()
        fieldnames = ["location_id", "verified", "corrected_street", "corrected_street_code", "notes", "timestamp"]
        with open(RESULTS_FILE, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t", extrasaction="ignore")
            writer.writeheader()
            for r in rows:
                writer.writerow(dict(r))

    @classmethod
    def export_corrections_to_tsv(cls):
        if cls.db is None:
            cls.db = get_db(cls.db_path or DEFAULT_DB)
        db = cls.db
        rows = db.execute("SELECT * FROM equipment_corrections ORDER BY equip_type, equip_id, location_index").fetchall()
        fieldnames = ["equip_type", "equip_id", "location_index", "corrected_code", "corrected_name", "notes", "timestamp", "verified"]
        with open(EQUIP_CORRECTIONS_FILE, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter="\t", extrasaction="ignore")
            writer.writeheader()
            for r in rows:
                writer.writerow(dict(r))


def main():
    port = 8080
    host = "0.0.0.0"
    db_path = DEFAULT_DB

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == "--port" and i + 1 < len(args):
            port = int(args[i + 1])
            i += 2
        elif args[i] == "--host" and i + 1 < len(args):
            host = args[i + 1]
            i += 2
        elif args[i] == "--db" and i + 1 < len(args):
            db_path = Path(args[i + 1])
            if not db_path.exists():
                print(f"ERRO: banco nao encontrado: {db_path}", flush=True)
                print("Execute import_db.py primeiro.", flush=True)
                sys.exit(1)
            i += 2
        else:
            try:
                port = int(args[i])
            except ValueError:
                print(f"Argumento desconhecido: {args[i]}")
                sys.exit(1)
            i += 1

    if not db_path.exists():
        print(f"ERRO: banco nao encontrado: {db_path}", flush=True)
        print("Execute import_db.py primeiro.", flush=True)
        sys.exit(1)

    print(f"Banco: {db_path}", flush=True)
    Handler.set_db_path(db_path)
    print("Inicializando dados...", flush=True)
    Handler.init_data()

    server = HTTPServer((host, port), Handler)
    print(f"Servidor rodando em http://localhost:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nEncerrando.", flush=True)
        server.shutdown()
        Handler.export_results_to_tsv()
        Handler.export_corrections_to_tsv()
        print("Dados exportados para TSV.", flush=True)


if __name__ == "__main__":
    main()
