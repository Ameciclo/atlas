#!/usr/bin/env python3
"""
v2 — Crosswalk entre counting_locations e survey-locations
Filtra 2015, deduplica por (rua, ano), e cruza com counting locations.
Gera relatório com proposta de correção de GPS.
"""

import json
import math
import sys
import unicodedata
from collections import defaultdict

import urllib.request

# ── Config ────────────────────────────────────────────────────────────
COUNTING_API = "http://localhost:3002/v1/locations"
SURVEY_API = "http://localhost:3000/v1/cyclist-profiles/survey-locations?min_interviews=0"
OUTPUT_CSV = "apps/cyclist-profile/src/db/pipeline/crosswalk-relatorio.csv"
YEARS_VALIDOS = {"2018", "2021", "2024"}

# ── helpers ───────────────────────────────────────────────────────────

def haversine(lat1, lon1, lat2, lon2):
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def normalizar(name: str) -> str:
    """Expande abreviações, lowercase, sem acento."""
    subs = [
        (" Av. ",  " Avenida "), ("^Av. ",  "Avenida "),
        (" R. ",   " Rua "),     ("^R. ",   "Rua "),
        (" Rua. ", " Rua "),     ("^Rua. ", "Rua "),
        (" Prof. ", " Professor "), ("^Prof. ", "Professor "),
        (" Gov. ",  " Governador "), ("^Gov. ",  "Governador "),
        (" Gal. ",  " General "),    ("^Gal. ",  "General "),
        (" Pres. ", " Presidente "), ("^Pres. ", "Presidente "),
        (" Cons. ", " Conselheiro "),("^Cons. ", "Conselheiro "),
        (" Eng. ",  " Engenheiro "), ("^Eng. ",  "Engenheiro "),
        (" Dr. ",   " Doutor "),     ("^Dr. ",   "Doutor "),
        (" Cap. ",  " Capitão "),    ("^Cap. ",  "Capitão "),
        (" Pe. ",   " Padre "),      ("^Pe. ",   "Padre "),
        (" Pte. ",  " Ponte "),      ("^Pte. ",  "Ponte "),
    ]
    n = name
    for pat, repl in subs:
        n = n.replace(pat, repl)
    n = unicodedata.normalize("NFKD", n).encode("ascii", "ignore").decode()
    n = n.lower().strip()
    for suffix in [" - pista leste", " - pista oeste", " | jaboatao"]:
        n = n.replace(suffix, "")
    return " ".join(n.split())


def tokenizar(name: str) -> set:
    return set(name.split())


def split_interseccao(name: str) -> tuple:
    for sep in [" x ", " X ", " com "]:
        if sep in name:
            p = name.split(sep, 1)
            return (p[0].strip(), p[1].strip())
    return (name.strip(), "")


def similaridade(norm_a: str, norm_b: str) -> float:
    a1, a2 = split_interseccao(norm_a)
    b1, b2 = split_interseccao(norm_b)

    def sim_tok(s1, s2):
        t1, t2 = tokenizar(s1), tokenizar(s2)
        if not t1 or not t2:
            return 0
        return len(t1 & t2) / max(len(t1), len(t2))

    if not a2 and not b2:
        return sim_tok(norm_a, norm_b)

    if a2 and b2:
        fwd = min(sim_tok(a1, b1), sim_tok(a2, b2))
        rev = min(sim_tok(a1, b2), sim_tok(a2, b1))
        return max(fwd, rev)

    # uma é interseção, outra é rua simples
    if a2 and not b2:
        return max(sim_tok(a1, b1), sim_tok(a2, b1))
    else:
        return max(sim_tok(a1, b1), sim_tok(a1, b2))


def classificar(score: float) -> str:
    if score >= 0.9:  return "exato"
    if score >= 0.5:  return "forte"
    if score >= 0.25: return "parcial"
    return "fraco"


def fetch_json(url: str):
    print(f"  GET {url} ...", end=" ", flush=True)
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            return json.load(resp)
    except Exception as e:
        print(f"ERRO: {e}")
        sys.exit(1)


# ── main ──────────────────────────────────────────────────────────────

def main():
    print("=== Crosswalk v2 — survey-locations (2018/2021/2024) x counting-locations ===\n")

    # 1. fetch
    print("[1/5] Buscando dados...")
    counts = fetch_json(COUNTING_API)
    surveys_raw = fetch_json(SURVEY_API)
    survey_locations = surveys_raw.get("locations", surveys_raw) if isinstance(surveys_raw, dict) else surveys_raw

    # 2. filter 2015
    print(f"\n[2/5] Filtrando — removendo 2015...")
    before = len(survey_locations)
    survey_locations = [
        l for l in survey_locations
        if l["location_info"]["survey_year"] in YEARS_VALIDOS
    ]
    print(f"  {before} -> {len(survey_locations)} entradas")
    years_found = set(l["location_info"]["survey_year"] for l in survey_locations)
    print(f"  Anos restantes: {sorted(years_found)}")

    # 3. deduplicate by (street, year) -> merge stats
    print(f"\n[3/5] Deduplicando por rua+ano...")
    grouped = defaultdict(list)
    for l in survey_locations:
        key = (l["location_info"]["street"], l["location_info"]["survey_year"])
        grouped[key].append(l)

    unique_locations = []
    for (street, year), locs in grouped.items():
        total = sum(int(l["statistics"]["total_responses"]) for l in locs)
        # pega a entrada com mais total_responses como representante
        best = max(locs, key=lambda x: int(x["statistics"]["total_responses"]))
        # moda do area
        from collections import Counter as C
        best_area = C(l["location_info"]["area"] for l in locs).most_common(1)[0][0]
        best_hood = C(l["location_info"]["neighborhood"] for l in locs).most_common(1)[0][0]
        unique_locations.append({
            "street": street,
            "year": year,
            "total": total,
            "lat": best["coordinates"]["lat"],
            "lon": best["coordinates"]["lon"],
            "area": best_area,
            "neighborhood": best_hood,
        })
    print(f"  {len(survey_locations)} -> {len(unique_locations)} entradas unicas")
    for y in sorted(years_found):
        n = sum(1 for l in unique_locations if l["year"] == y)
        print(f"    {y}: {n}")

    # 4. normalize counting locations
    print(f"\n[4/5] Normalizando e fazendo crosswalk...")
    c_entries = []
    for loc in counts:
        c_entries.append({
            "name": loc["name"],
            "norm": normalizar(loc["name"]),
            "lat": float(loc["latitude"]),
            "lon": float(loc["longitude"]),
        })

    # 5. match each unique survey to best counting
    rows = []
    for s in unique_locations:
        s_norm = normalizar(s["street"])
        best_score = -1
        best_c = None
        for c in c_entries:
            score = similaridade(s_norm, c["norm"])
            if score > best_score:
                best_score = score
                best_c = c

        if best_c:
            dist = haversine(best_c["lat"], best_c["lon"], s["lat"], s["lon"])
            conf = classificar(best_score)
            precisa = (conf in ("exato", "forte") and dist > 50)
        else:
            dist = -1
            conf = "sem_match"
            precisa = False

        rows.append({
            "survey_street": s["street"],
            "survey_year": s["year"],
            "survey_lat": s["lat"],
            "survey_lon": s["lon"],
            "survey_area": s["area"],
            "survey_hood": s["neighborhood"],
            "survey_total": s["total"],
            "counting_name": best_c["name"] if best_c else "",
            "counting_lat": best_c["lat"] if best_c else "",
            "counting_lon": best_c["lon"] if best_c else "",
            "similarity": round(best_score, 2),
            "confidence": conf,
            "distance_m": round(dist, 1) if dist >= 0 else "N/A",
            "precisa_corrigir": "SIM" if precisa else "",
        })

    rows.sort(key=lambda r: (r["confidence"], -r["similarity"]))

    # ── CSV ──
    headers = [
        "survey_year", "survey_street", "survey_total", "survey_area", "survey_hood",
        "survey_lat", "survey_lon",
        "counting_name", "counting_lat", "counting_lon",
        "distance_m", "similarity", "confidence", "precisa_corrigir",
    ]
    with open(OUTPUT_CSV, "w") as f:
        f.write(",".join(headers) + "\n")
        for r in rows:
            vals = [str(r.get(h, "")) for h in headers]
            f.write(",".join(vals) + "\n")

    # ── Term ──
    print(f"\n[5/5] Relatorio\n")
    fmt = "{:<12} {:>4} {:>5} | {:<5} {:<52} | {:<52} | {:>7} {:>8} {:>6} | {}".format
    print(fmt("ANO", "TOT", "CONF", "PREC?","SURVEY STREET", "COUNTING NAME", "DIST(m)", "SIM", "SCORE", "CORRIGIR?"))
    print("-" * 180)

    for r in rows:
        corr = r["precisa_corrigir"]
        print(fmt(
            r["survey_year"], r["survey_total"], r["confidence"],
            corr,
            r["survey_street"][:51],
            (r["counting_name"] or "(sem match)")[:51],
            str(r["distance_m"]),
            f'{r["similarity"]:.2f}',
            r["confidence"],
            "*** CORRIGIR ***" if corr else "",
        ))

    # ── Resumo ──
    corrigiveis = [r for r in rows if r["precisa_corrigir"] == "SIM"]
    print(f"\n{'='*80}")
    print(f"Total: {len(rows)} entradas unicas")
    print(f"Precisam de correcao: {len(corrigiveis)}")
    for y in sorted(years_found):
        total_y = sum(1 for r in rows if r["survey_year"] == y)
        corr_y = sum(1 for r in corrigiveis if r["survey_year"] == y)
        if corr_y:
            print(f"  {y}: {corr_y}/{total_y} precisam correcao")

    print(f"\nRelatorio CSV: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
