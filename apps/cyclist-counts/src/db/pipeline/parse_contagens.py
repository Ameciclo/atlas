#!/usr/bin/env python3
"""
Convert Ameciclo counting spreadsheets (CSV) into the legacy JSON format
used by seed-cyclist-counts.ts.

The CSV format has 3 sections:
  1. Dados quantitativos e sentido de deslocamento — 12 origin→destination pairs × 14 hours
  2. Dados qualitativos padrões — standard characteristics (women, helmet, cargo, etc.)
  3. Dados qualitativos das observações — additional observations (motor, electric, etc.)

Direction mapping is positional (not name-based):
  Rows 3-5  → north_*   (first origin = north)
  Rows 6-8  → east_*    (fourth origin = east)
  Rows 9-11 → south_*   (seventh origin = south)
  Rows 12-14→ west_*    (tenth origin = west)

Usage:
  python parse_contagens.py --file "01. 2026.04.09 - ...csv"
  python parse_contagens.py --dir pipeline/ --output merged.json
  python parse_contagens.py --file dados.csv --locations locations.csv
"""

import argparse
import csv as csv_module
import glob
import json
import os
import re
import sys
from datetime import datetime, timezone, timedelta

# ──────────────────────────────────────────────
# IBGE city lookup (common RMR cities)
# ──────────────────────────────────────────────
IBGE_CITIES: dict[str, dict] = {
    "abreu e lima":                 {"id": 2600054, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "araçoiaba":                    {"id": 2601052, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "cabo de santo agostinho":      {"id": 2602902, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "camaragibe":                   {"id": 2603454, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "igarassu":                     {"id": 2606804, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "ipojuca":                      {"id": 2607208, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "ilha de itamaracá":            {"id": 2607604, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "itapissuma":                   {"id": 2607752, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "jaboatão dos guararapes":      {"id": 2607901, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "moreno":                       {"id": 2609402, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "olinda":                       {"id": 2609600, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "paulista":                     {"id": 2610707, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "recife":                       {"id": 2611606, "state": "PE", "full_state": "Pernambuco", "rmr": True},
    "são lourenço da mata":         {"id": 2613701, "state": "PE", "full_state": "Pernambuco", "rmr": True},
}

# Each row offset from the first data row maps to a directional pair
DIRECTION_MAP = [
    "north_east", "north_south", "north_west",
    "east_north", "east_south", "east_west",
    "south_north", "south_east", "south_west",
    "west_north", "west_east", "west_south",
]

CHARACTERISTIC_TEMPLATE = {
    "cargo": 0, "helmet": 0, "juveniles": 0, "motor": 0,
    "other_active_modes": 0, "other_behaviors": 0, "others": 0,
    "rain": 0, "ride": 0, "service": 0, "shared_bike": 0,
    "sidewalk": 0, "women": 0, "wrong_way": 0,
}

BRT_OFFSET = timedelta(hours=3)  # UTC-3

# ──────────────────────────────────────────────
# CSV parsing helpers
# ──────────────────────────────────────────────

def parse_csv_sections(filepath: str) -> dict:
    """
    Parse the counting CSV into its 3 logical sections.

    Returns: {
        "quantitative": [list of 12 data rows, each a list of 14 ints],
        "qualitative_patterns": {label: [14 ints]},
        "qualitative_observations": {label: [14 ints]},
        "direction_names": {north: str, east: str, south: str, west: str},
        "total_row": list of 14 ints (for validation),
    }
    """
    with open(filepath, encoding="utf-8") as f:
        reader = csv_module.reader(f)
        raw_rows = list(reader)

    # Detect sections by row content
    section = None
    quant_rows: list[list[str]] = []
    qual_patterns: list[list[str]] = []
    qual_obs: list[list[str]] = []
    header_row: list[str] | None = None

    for row in raw_rows:
        if not row or all(c == "" for c in row):
            continue

        # Join all non-empty fields to detect section headers
        joined = " ".join(f for f in row if f).strip()

        if "Dados quantitativos" in joined:
            section = "quant_header"
            continue
        if "Dados qualitativos padr" in joined:
            section = "qual_patterns"
            continue
        if "Dados qualitativos das observa" in joined:
            section = "qual_obs"
            continue

        if section == "quant_header":
            if "ORIGEM" in joined and "DESTINO" in joined:
                header_row = [c.strip() for c in row]
                section = "quant_data"
                continue
        elif section == "quant_data":
            # Stop when we hit TOTAL or Percentual rows
            if "TOTAL" in joined:
                section = None
                continue
            if "Percentual" in joined:
                continue
            quant_rows.append(row)
        elif section == "qual_patterns":
            if "Caracter" in joined:
                continue
            label = (row[1] or row[2] or "").strip()
            if label and row[3] and row[3].strip().lstrip("-").isdigit():
                qual_patterns.append(row)
        elif section == "qual_obs":
            if "Caracter" in joined:
                continue
            label = (row[1] or row[2] or "").strip()
            if label and row[3] and row[3].strip().lstrip("-").isdigit():
                qual_obs.append(row)

    if len(quant_rows) != 12:
        print(
            f"  ⚠️  Expected 12 quantitative data rows, found {len(quant_rows)}",
            file=sys.stderr,
        )

    # Extract direction names from the first row of each quadrant
    direction_names = {}
    if len(quant_rows) >= 12:
        direction_names["north"] = quant_rows[0][1].strip()   # row 0: north→east origin
        direction_names["east"]  = quant_rows[3][1].strip()   # row 3: east→north origin
        direction_names["south"] = quant_rows[6][1].strip()   # row 6: south→north origin
        direction_names["west"]  = quant_rows[9][1].strip()   # row 9: west→north origin

    # Parse qualitative rows into {label: [14 hourly values]}
    def parse_qual_rows(rows: list[list[str]]) -> dict[str, list[int]]:
        result: dict[str, list[int]] = {}
        for row in rows:
            # Label is in col 1 (quantitative-style) or col 2 (qualitative-style with extra comma)
            label = (row[1] or row[2] or "").strip()
            if not label:
                continue
            values = []
            for i in range(3, 17):
                try:
                    val = row[i].strip() if i < len(row) and row[i] else "0"
                    values.append(int(val))
                except (IndexError, ValueError):
                    values.append(0)
            result[label] = values
        return result

    return {
        "quantitative": quant_rows,
        "qualitative_patterns": parse_qual_rows(qual_patterns),
        "qualitative_observations": parse_qual_rows(qual_obs),
        "direction_names": direction_names,
    }


def parse_quantitative(rows: list[list[str]]) -> list[list[int]]:
    """
    Parse the 12 quantitative rows into a list of 12 directional pairs,
    each with 14 hourly values.
    """
    result = []
    for row in rows[:12]:
        values = []
        for i in range(3, 17):
            try:
                values.append(int(row[i]) if row[i] else 0)
            except (IndexError, ValueError):
                values.append(0)
        result.append(values)
    return result


# ──────────────────────────────────────────────
# Characteristics aggregation
# ──────────────────────────────────────────────

def sum_qual_rows(patterns: dict[str, list[int]], keys: list[str]) -> list[int]:
    """Sum multiple qualitative rows (element-wise across 14 hours)."""
    result = [0] * 14
    for key in keys:
        for label, values in patterns.items():
            if key.lower() in label.lower():
                for h in range(14):
                    result[h] += values[h]
                break  # match first label only
    return result


def build_characteristics(
    patterns: dict[str, list[int]],
    observations: dict[str, list[int]],
    hour_idx: int,
) -> dict[str, int]:
    """Build the characteristics object for a single hour."""
    # Aggregate values from patterns and observations
    def agg(section: dict, keywords: list[str]) -> int:
        total = 0
        for label, values in section.items():
            for kw in keywords:
                if kw.lower() in label.lower():
                    total += values[hour_idx]
                    break
        return total

    return {
        "cargo": agg(patterns, ["cargueira", "adaptada a carga"]),
        "helmet": agg(patterns, ["capacete"]),
        "juveniles": agg(patterns, ["criança"]),
        "motor": agg(observations, ["elétrica", "motorizada", "ciclomotor"]),
        "other_active_modes": agg(observations, ["empurrando", "triciclo", "skate", "patináv"]),
        "other_behaviors": 0,
        "others": agg(observations, ['"outros" atalho', "outros"]),
        "rain": 0,
        "ride": agg(patterns, ["carona"]),
        "service": agg(patterns, ["serviço"]),
        "shared_bike": agg(observations, ["bike pe"]),
        "sidewalk": agg(patterns, ["calçada"]),
        "women": agg(patterns, ["mulher"]),
        "wrong_way": agg(patterns, ["contramão"]),
    }


# ──────────────────────────────────────────────
# Filename parsing
# ──────────────────────────────────────────────

def parse_filename(filepath: str) -> dict | None:
    """
    Extract metadata from the filename.

    Expected format:
      "01. YYYY.MM.DD - Dados da Contagem - <name> I <city> - Dados.csv"
    or:
      "01. YYYY.MM.DD - <name> I <city> - Dados.csv"
    """
    basename = os.path.basename(filepath)
    basename = basename.removesuffix(".csv")

    # Extract date: YYYY.MM.DD
    date_match = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", basename)
    if not date_match:
        print(f"  ⚠️  Could not extract date from filename: {basename}", file=sys.stderr)
        return None

    year, month, day = date_match.groups()
    date_str = f"{int(year)}-{int(month)}-{int(day)}"

    # Extract location name and city from after the last " - " before Dados
    # Split by " - " and look for the segment containing " I "
    parts = basename.split(" - ")
    location_part = None
    for part in parts:
        if " I " in part:
            location_part = part
            break

    if not location_part and len(parts) >= 2:
        # Fallback: use the last meaningful part before "Dados"
        for part in reversed(parts):
            if "Dados" not in part and len(part) > 5:
                location_part = part
                break

    if not location_part:
        print(f"  ⚠️  Could not extract location from filename: {basename}", file=sys.stderr)
        return None

    # Split location by " I " to get name and city
    if " I " in location_part:
        name, city_str = location_part.rsplit(" I ", 1)
    else:
        name = location_part
        city_str = ""

    name = name.strip().strip('"').strip("'")
    city_str = city_str.strip().strip('"').strip("'").lower()

    # Look up city in IBGE database
    city_info = IBGE_CITIES.get(city_str)
    if not city_info:
        # Try fuzzy match
        for key, val in IBGE_CITIES.items():
            if key in city_str or city_str in key:
                city_info = val
                break

    if not city_info:
        print(f"  ⚠️  Unknown city '{city_str}', using empty city info", file=sys.stderr)
        city_info = {"id": 0, "state": "PE", "full_state": "Pernambuco", "rmr": True}

    return {
        "date": date_str,
        "name": name,
        "city": {
            "id": city_info["id"],
            "name": city_str.title(),
            "state": city_info["state"],
            "full_state": city_info["full_state"],
            "rmr": city_info["rmr"],
        },
    }


def resolve_city(city_str: str) -> dict:
    """Look up city in IBGE_CITIES with fuzzy matching."""
    city_str = city_str.lower().strip()
    city_info = IBGE_CITIES.get(city_str)
    if not city_info:
        for key, val in IBGE_CITIES.items():
            if key in city_str or city_str in key:
                city_info = val
                break
    if not city_info:
        print(
            f"  ⚠️  Unknown city '{city_str}', using empty city info",
            file=sys.stderr,
        )
        city_info = {"id": 0, "state": "PE", "full_state": "Pernambuco", "rmr": True}
    return city_info


def point_in_polygon(lon: float, lat: float, polygon: list) -> bool:
    """Ray casting algorithm: returns True if point is inside polygon."""
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def point_in_multipolygon(lon: float, lat: float, multipolygon: list) -> bool:
    """Check if point is inside any polygon in a MultiPolygon."""
    for polygon_coords in multipolygon:
        exterior_ring = polygon_coords[0]
        if point_in_polygon(lon, lat, exterior_ring):
            return True
    return False


def load_boundaries(geojson_path: str) -> list[tuple[int, str, list]]:
    """Load municipal boundaries from GeoJSON. Returns [(city_id, name, multipolygon_coords), ...]."""
    print(f"📍 Loading municipal boundaries from {geojson_path}...", file=sys.stderr)
    with open(geojson_path, encoding="utf-8") as f:
        boundaries_data = json.load(f)

    boundaries = []
    for feature in boundaries_data["features"]:
        props = feature["properties"]
        city_id = int(props["CD_MUN"])
        name = props["NM_MUN"]
        geometry = feature["geometry"]
        if geometry["type"] == "MultiPolygon":
            coords = geometry["coordinates"]
        elif geometry["type"] == "Polygon":
            coords = [geometry["coordinates"]]
        else:
            continue
        boundaries.append((city_id, name, coords))
    print(f"  Loaded {len(boundaries)} municipal boundaries", file=sys.stderr)
    return boundaries


def find_city_by_coords(
    lat: float, lng: float, boundaries: list[tuple[int, str, list]]
) -> tuple[int | None, str | None]:
    """Find which municipality contains the given coordinates."""
    for city_id, name, multipolygon in boundaries:
        if point_in_multipolygon(lng, lat, multipolygon):
            return city_id, name
    return None, None


def parse_resumo(filepath: str) -> dict | None:
    """
    Parse a Resumo CSV (first sheet) to extract metadata.

    Resumo format:
      Cruzamento,<intersection> [| <city>]
      Data,dd/mm/yyyy
      Coordenadas Geográficas,"<lat>, <lng>"
    """
    with open(filepath, encoding="utf-8") as f:
        reader = csv_module.reader(f)
        rows = list(reader)

    result: dict = {}
    for row in rows:
        if len(row) < 2 or not row[0].strip():
            continue
        key = row[0].strip()
        value = row[1].strip()

        if key == "Cruzamento":
            if " | " in value:
                name, city_str = value.rsplit(" | ", 1)
                result["name"] = name.strip()
                result["city_str"] = city_str.strip()
            else:
                result["name"] = value
        elif key == "Data":
            parts = value.split("/")
            if len(parts) == 3:
                try:
                    result["date"] = (
                        f"{int(parts[2])}-{int(parts[1]):02d}-{int(parts[0]):02d}"
                    )
                except ValueError:
                    pass
        elif key == "Coordenadas Geográficas":
            value = value.replace('"', "").replace("'", "")
            parts = value.split(",")
            if len(parts) == 2:
                try:
                    result["lat"] = float(parts[0].strip())
                    result["lng"] = float(parts[1].strip())
                except ValueError:
                    pass

    if "name" not in result or "date" not in result:
        print(
            f"  ⚠️  Incomplete Resumo in {os.path.basename(filepath)}",
            file=sys.stderr,
        )
        return None

    return result


def find_resumo(dados_filepath: str) -> str | None:
    """Given a Dados CSV filename, find the matching Resumo CSV."""
    dirname = os.path.dirname(dados_filepath)
    basename = os.path.basename(dados_filepath)
    match = re.match(r"([a-zA-Z0-9_-]+)_dados\.csv", basename)
    if match:
        sheet_id = match.group(1)
        candidate = os.path.join(dirname, f"{sheet_id}_resumo.csv")
        if os.path.exists(candidate):
            return candidate
    return None


# ──────────────────────────────────────────────
# Location coordinates
# ──────────────────────────────────────────────

def load_coordinates(coords_file: str) -> dict[str, tuple[float, float]]:
    """Load location name → (lat, lng) from a CSV file."""
    result = {}
    with open(coords_file, encoding="utf-8") as f:
        reader = csv_module.DictReader(f)
        for row in reader:
            name = row.get("name", "").strip().lower()
            try:
                lat = float(row.get("lat", row.get("latitude", 0)))
                lng = float(row.get("lng", row.get("longitude", row.get("lon", 0))))
            except (ValueError, TypeError):
                continue
            if name and lat and lng:
                result[name] = (lat, lng)
    return result


# ──────────────────────────────────────────────
# Main conversion
# ──────────────────────────────────────────────

def convert_file(
    filepath: str,
    event_id: int,
    coords_lookup: dict[str, tuple[float, float]] | None = None,
    boundaries: list[tuple[int, str, list]] | None = None,
) -> dict | None:
    """
    Convert a single counting CSV file to the legacy JSON format.

    Returns the event dict, or None on failure.
    """
    print(f"📊 Processing: {os.path.basename(filepath)}", file=sys.stderr)

    resumo_path = find_resumo(filepath)
    resumo_data = parse_resumo(resumo_path) if resumo_path else None

    if resumo_data:
        name = resumo_data["name"]
        date_str = resumo_data["date"]
        city_str = resumo_data.get("city_str", "")
        coords = None
        if "lat" in resumo_data and "lng" in resumo_data:
            coords = (resumo_data["lat"], resumo_data["lng"])
    else:
        meta = parse_filename(filepath)
        if not meta:
            return None
        name = meta["name"]
        date_str = meta["date"]
        city_str = meta["city"]["name"]
        coords = None

    city_info = resolve_city(city_str) if city_str else {
        "id": 0, "state": "PE", "full_state": "Pernambuco", "rmr": True,
    }

    if not city_str and coords and boundaries:
        lat, lng = coords
        matched_id, matched_name = find_city_by_coords(lat, lng, boundaries)
        if matched_id and matched_name:
            city_str = matched_name
            city_info = resolve_city(matched_name)

    sections = parse_csv_sections(filepath)
    quant = parse_quantitative(sections["quantitative"])

    if len(quant) != 12:
        print(f"  ❌ Expected 12 directional rows, got {len(quant)}", file=sys.stderr)
        return None

    patterns = sections["qualitative_patterns"]
    observations = sections["qualitative_observations"]
    direction_names = sections["direction_names"]

    if coords is None and coords_lookup:
        name_key = name.lower()
        coords = coords_lookup.get(name_key)
        if not coords:
            for key, val in coords_lookup.items():
                if key in name_key or name_key in key:
                    coords = val
                    break

    try:
        date_parts = date_str.split("-")
        d = datetime(int(date_parts[0]), int(date_parts[1]), int(date_parts[2]))
    except (ValueError, IndexError):
        print(f"  ❌ Invalid date: {date_str}", file=sys.stderr)
        return None

    sessions = []
    for h in range(6, 20):
        hour_idx = h - 6

        start = d.replace(hour=h, minute=0, second=0, microsecond=0) + BRT_OFFSET
        end = start + timedelta(hours=1)

        quantitative = {}
        total = 0
        for di, pair in enumerate(DIRECTION_MAP):
            val = quant[di][hour_idx]
            quantitative[pair] = val
            total += val

        characteristics = build_characteristics(patterns, observations, hour_idx)

        sessions.append({
            "session": f"{h:02d}-{h + 1:02d}",
            "start_time": start.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "end_time": end.strftime("%Y-%m-%dT%H:%M:%S.000Z"),
            "total_cyclists": total,
            "quantitative": quantitative,
            "characteristics": characteristics,
        })

    event = {
        "id": event_id,
        "coordinates": {
            "x": coords[1] if coords else 0,
            "y": coords[0] if coords else 0,
        },
        "metadata": {
            "name": name,
            "date": date_str,
            "city": {
                "id": city_info["id"],
                "name": city_str.title() if city_str else "",
                "state": city_info["state"],
                "full_state": city_info["full_state"],
                "rmr": city_info["rmr"],
            },
            "directions": direction_names,
        },
        "data": {
            "sessions": sessions,
        },
    }

    if not coords:
        print(
            f"  ⚠️  No coordinates for '{name}'. "
            f"Seed will skip this entry. Use --locations to provide coordinates.",
            file=sys.stderr,
        )

    total_cyclists = sum(s["total_cyclists"] for s in sessions)
    print(
        f"  ✅ {date_str} | {city_info.get('full_state', '')} | "
        f"{name} | {total_cyclists} cyclists | {len(sessions)} sessions",
        file=sys.stderr,
    )

    return event


# ──────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Convert Ameciclo counting CSVs to seed JSON format."
    )
    parser.add_argument(
        "--file",
        help="Single CSV file to convert",
    )
    parser.add_argument(
        "--dir",
        help="Directory containing multiple CSV files to convert",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="data.json",
        help="Output JSON file path (default: data.json in current dir)",
    )
    parser.add_argument(
        "--locations",
        help="CSV file with location coordinates (columns: name, lat, lng)",
    )
    parser.add_argument(
        "--start-id",
        type=int,
        default=1,
        help="Starting event ID (default: 1)",
    )
    parser.add_argument(
        "--boundaries",
        help="GeoJSON file with municipal boundaries for city lookup (default: auto-detect)",
    )
    args = parser.parse_args()

    # Auto-detect boundaries GeoJSON
    boundaries_path = args.boundaries
    if not boundaries_path:
        default_boundaries = os.path.join(
            os.path.dirname(__file__),
            "..", "..", "..", "..", "cycling-infra", "src", "db",
            "pe_limites_municipais.geojson",
        )
        if os.path.exists(default_boundaries):
            boundaries_path = default_boundaries

    boundaries = load_boundaries(boundaries_path) if boundaries_path else None

    # Load coordinates
    coords_lookup = None
    if args.locations:
        coords_lookup = load_coordinates(args.locations)
        print(f"📍 Loaded {len(coords_lookup)} coordinates from {args.locations}", file=sys.stderr)

    # Gather input files
    files = []
    if args.file:
        files.append(args.file)
    if args.dir:
        pattern = os.path.join(args.dir, "*.csv")
        files.extend(sorted(glob.glob(pattern)))

    if not files:
        print("❌ No CSV files specified. Use --file or --dir.", file=sys.stderr)
        parser.print_help()
        sys.exit(1)

    print(f"\n📋 Processing {len(files)} file(s)...\n", file=sys.stderr)

    # Convert all files
    events = []
    event_id = args.start_id
    for f in files:
        basename = os.path.basename(f)
        if basename == "locations.csv" or basename.endswith("_resumo.csv"):
            continue
        event = convert_file(f, event_id, coords_lookup, boundaries)
        if event:
            events.append(event)
            event_id += 1

    if not events:
        print("\n❌ No events were successfully converted.", file=sys.stderr)
        sys.exit(1)

    # Write output
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(events, f, indent="\t", ensure_ascii=False)

    print(f"\n{'='*50}", file=sys.stderr)
    print(f"✅ Converted {len(events)} events → {args.output}", file=sys.stderr)
    print(f"{'='*50}\n", file=sys.stderr)


if __name__ == "__main__":
    main()
