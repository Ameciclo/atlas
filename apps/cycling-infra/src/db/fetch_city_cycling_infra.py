#!/usr/bin/env python3
"""
Fetch ALL cycling infrastructure for a city using Overpass area query.

Usage:
  python fetch_city_cycling_infra.py --city "Recife" --state "Pernambuco" --city-id 2611606
  python fetch_city_cycling_infra.py --city "Recife" --state "Pernambuco" --city-id 2611606 --endpoint https://overpass-api.de/api/interpreter

If no --name is given, the area name defaults to "City, State, Brasil".
Output is written to <slug>.geojson and <slug>_ways.json.
"""
import argparse
import json
import math
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

DEFAULT_TIMEOUT = 300
DEFAULT_USER_AGENT = "cycling-infra-atlas/1.0"

RMR_CITY_NAMES = {
    2600054: "Abreu e Lima",
    2601052: "Araçoiaba",
    2602902: "Cabo de Santo Agostinho",
    2603454: "Camaragibe",
    2606804: "Igarassu",
    2607208: "Ipojuca",
    2607604: "Ilha de Itamaracá",
    2607752: "Itapissuma",
    2607901: "Jaboatão dos Guararapes",
    2609402: "Moreno",
    2609600: "Olinda",
    2610707: "Paulista",
    2611606: "Recife",
    2613701: "São Lourenço da Mata",
}

# Filters that match ciclomapa's layers.json EXACTLY
# Each entry: (layer_name, filter_parts)
# where filter_parts is either a single [key, value] or [[key1, val1], [key2, val2]]
INFRA_FILTERS = [
    # === Ciclovia ===
    ("Ciclovia", ["highway", "cycleway"]),
    ("Ciclovia", ["cycleway", "track"]),
    ("Ciclovia", ["cycleway:left", "track"]),
    ("Ciclovia", ["cycleway:right", "track"]),
    ("Ciclovia", ["cycleway", "opposite_track"]),
    ("Ciclovia", ["cycleway:left", "opposite_track"]),
    ("Ciclovia", ["cycleway:right", "opposite_track"]),
    # === Calçada compartilhada ===
    ("Calçada compartilhada", [["highway", "footway"], ["bicycle", "designated"]]),
    ("Calçada compartilhada", [["highway", "pedestrian"], ["bicycle", "designated"]]),
    ("Calçada compartilhada", [["highway", "pedestrian"], ["bicycle", "yes"]]),
    ("Calçada compartilhada", ["cycleway", "sidepath"]),
    ("Calçada compartilhada", ["cycleway:left", "sidepath"]),
    ("Calçada compartilhada", ["cycleway:right", "sidepath"]),
    # === Ciclofaixa ===
    ("Ciclofaixa", ["cycleway", "lane"]),
    ("Ciclofaixa", ["cycleway:left", "lane"]),
    ("Ciclofaixa", ["cycleway:right", "lane"]),
    ("Ciclofaixa", ["cycleway:both", "lane"]),
    ("Ciclofaixa", ["cycleway", "opposite_lane"]),
    ("Ciclofaixa", ["cycleway:left", "opposite_lane"]),
    ("Ciclofaixa", ["cycleway:right", "opposite_lane"]),
    # === Ciclorrota ===
    ("Ciclorrota", ["cycleway", "buffered_lane"]),
    ("Ciclorrota", ["cycleway:left", "buffered_lane"]),
    ("Ciclorrota", ["cycleway:right", "buffered_lane"]),
    ("Ciclorrota", ["cycleway", "shared_lane"]),
    ("Ciclorrota", ["cycleway:left", "shared_lane"]),
    ("Ciclorrota", ["cycleway:right", "shared_lane"]),
    ("Ciclorrota", ["cycleway", "share_busway"]),
    ("Ciclorrota", ["cycleway:left", "share_busway"]),
    ("Ciclorrota", ["cycleway:right", "share_busway"]),
    ("Ciclorrota", ["cycleway", "opposite_share_busway"]),
]

# Ciclomapa-compatible cycling types
CYCLING_TYPES = {"Ciclovia", "Ciclofaixa", "Ciclorrota", "Calçada compartilhada"}

def slugify(name):
    a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·/_,:;'
    b = 'aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz------'
    p = re.compile('|'.join(re.escape(c) for c in a))
    name = name.lower().strip()
    name = p.sub(lambda m: b[a.index(m.group(0))], name)
    name = re.sub(r'\s+', '-', name)
    name = re.sub(r'[^\w-]+', '', name)
    name = re.sub(r'--+', '-', name)
    return name.strip('-')


def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    a = (math.sin(delta_lat / 2) ** 2 +
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def calculate_length(coords):
    if not coords or len(coords) < 2:
        return 0
    total = 0
    for i in range(len(coords) - 1):
        lat1, lon1 = coords[i]['lat'], coords[i]['lon']
        lat2, lon2 = coords[i + 1]['lat'], coords[i + 1]['lon']
        total += haversine_distance(lat1, lon1, lat2, lon2)
    return total / 1000


def classify_tags(tags):
    if not tags:
        return "Ciclorrota"

    if tags.get('highway') == 'cycleway':
        return "Ciclovia"

    cycleway_keys = ['cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both']
    for key in cycleway_keys:
        val = tags.get(key)
        if val in ('track', 'opposite_track'):
            return "Ciclovia"
        if val in ('sidepath',):
            return "Calçada compartilhada"
        if val in ('lane', 'opposite_lane'):
            return "Ciclofaixa"
        if val in ('shared_lane', 'buffered_lane', 'share_busway', 'opposite_share_busway'):
            return "Ciclorrota"

    highway = tags.get('highway')
    bicycle = tags.get('bicycle')
    if highway in ('footway', 'pedestrian') and bicycle in ('designated', 'yes'):
        return "Calçada compartilhada"
    if highway == 'cycleway':
        return "Ciclovia"
    if bicycle == 'designated':
        return "Ciclovia"

    return "Ciclorrota"


def build_overpass_query(area_id):
    lines = ["[out:json][timeout:500];", f"area({area_id})->.a;", "("]
    for layer_name, filter_parts in INFRA_FILTERS:
        element = "way"
        if isinstance(filter_parts[0], list):
            # Compound filter: way["k1"="v1"]["k2"="v2"](area.a)
            tag_str = "".join(f'["{k}"="{v}"]' for k, v in filter_parts)
            lines.append(f"    {element}{tag_str}(area.a);")
        else:
            # Simple filter: way["k"="v"](area.a)
            lines.append(f'    {element}["{filter_parts[0]}"="{filter_parts[1]}"]' + "(area.a);")
    lines.append(");")
    lines.append("out body geom;")
    return "\n".join(lines)


def resolve_city_area_id(city_name, state_name):
    """Resolve city to Overpass area ID via Nominatim."""
    q = f"{city_name}, {state_name}, Brasil"
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": q, "format": "json", "limit": 3, "addressdetails": 1,
              "accept-language": "pt-BR,pt,en"}
    headers = {"User-Agent": DEFAULT_USER_AGENT, "Accept": "application/json"}
    resp = requests.get(url, params=params, headers=headers, timeout=30)
    resp.raise_for_status()
    results = resp.json()
    if not results:
        raise RuntimeError(f"Nominatim could not find area: {q}")

    for r in results:
        if r.get("osm_type") == "relation":
            area_id = 3600000000 + int(r["osm_id"])
            return area_id, r["display_name"]
    return None, None


def execute_query(query, endpoint=None, timeout=DEFAULT_TIMEOUT):
    servers = [endpoint] if endpoint else OVERPASS_SERVERS
    last_error = None
    for srv in servers:
        try:
            resp = requests.post(srv, data=query,
                                 headers={"User-Agent": DEFAULT_USER_AGENT},
                                 timeout=timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            last_error = e
            continue
    raise RuntimeError(f"All Overpass servers failed: {last_error}")


def process_elements(elements, city_id, city_name, relation_ids=None):
    """Convert OSM elements to processed ways + GeoJSON features."""
    if relation_ids is None:
        relation_ids = set()

    ways_list = []
    geojson_features = []
    seen_osm_ids = set()

    for el in elements:
        if el.get("type") != "way":
            continue

        osm_id = el["id"]
        osm_id_str = f"way/{osm_id}"
        if osm_id_str in seen_osm_ids:
            continue
        seen_osm_ids.add(osm_id_str)

        tags = el.get("tags", {})
        geometry = el.get("geometry", [])

        typology = classify_tags(tags)
        if typology not in CYCLING_TYPES:
            continue

        length = calculate_length(geometry)
        dual_carriageway = tags.get("dual_carriageway") == "yes"
        if dual_carriageway:
            length = length / 2

        rel_id = el.get("relation_id", 0)
        if rel_id == 0:
            rel_id = 0
        pdc_typology = "Ciclovia" if (rel_id and rel_id != 0) else "notOnPDC"

        has_cycleway = True
        highway = tags.get("highway", "")

        coordinates = [[p["lon"], p["lat"]] for p in geometry]

        geojson_feature = {
            "id": osm_id_str,
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coordinates},
            "properties": {
                "id": osm_id_str,
                "name": tags.get("name", ""),
                "type": typology,
                **tags
            }
        }

        way_entry = {
            "osm_id": osm_id,
            "name": tags.get("name", ""),
            "length": round(length, 7),
            "highway": highway,
            "has_cycleway": has_cycleway,
            "cycleway_typology": typology,
            "relation_id": rel_id,
            "geojson": json.dumps({
                "type": "FeatureCollection",
                "features": [geojson_feature]
            }),
            "lastupdated": datetime.now().isoformat(),
            "city_id": city_id,
            "dual_carriageway": dual_carriageway,
            "pdc_typology": pdc_typology,
        }

        ways_list.append(way_entry)
        geojson_features.append(geojson_feature)

    return ways_list, geojson_features


def main():
    parser = argparse.ArgumentParser(description="Fetch cycling infra for a city")
    parser.add_argument("--city", required=True, help="City name (e.g. Recife)")
    parser.add_argument("--state", default="Pernambuco", help="State name")
    parser.add_argument("--city-id", type=int, required=True, help="IBGE city ID")
    parser.add_argument("--endpoint", default=None, help="Overpass endpoint override")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    parser.add_argument("--sleep", type=float, default=2, help="Seconds between retries")
    args = parser.parse_args()

    area_name = f"{args.city}, {args.state}, Brasil"
    slug = slugify(area_name)

    print(f"\n{'='*60}")
    print(f"Fetching cycling infra for: {area_name}")
    print(f"City ID: {args.city_id}")
    print(f"{'='*60}")

    # Resolve area ID via Nominatim
    print(f"\nResolving area via Nominatim...")
    area_id, display_name = resolve_city_area_id(args.city, args.state)
    if not area_id:
        print("Could not resolve area ID. Aborting.")
        sys.exit(1)
    print(f"Resolved: {display_name} (area_id={area_id})")

    # Build and execute Overpass query
    query = build_overpass_query(area_id)
    print(f"\nExecuting Overpass query...")
    print(f"Query length: {len(query)} chars")

    osm_data = execute_query(query, args.endpoint)
    elements = osm_data.get("elements", [])
    print(f"Received {len(elements)} OSM elements")

    if not elements:
        print("No data returned. Aborting.")
        sys.exit(0)

    # Process elements
    ways_list, geojson_features = process_elements(
        elements, args.city_id, args.city
    )

    print(f"Found {len(ways_list)} ways with cycling infrastructure")
    by_type = {}
    for w in ways_list:
        t = w["cycleway_typology"]
        by_type[t] = by_type.get(t, 0) + 1
    for t, c in sorted(by_type.items()):
        total_km = sum(w["length"] for w in ways_list if w["cycleway_typology"] == t)
        print(f"  {t}: {c} ways, {total_km:.2f} km")

    total_km = sum(w["length"] for w in ways_list)
    print(f"\nTotal: {len(ways_list)} ways, {total_km:.2f} km")

    # Save GeoJSON
    geojson_path = Path(args.output_dir) / f"{slug}.geojson"
    geojson_collection = {
        "type": "FeatureCollection",
        "features": geojson_features
    }
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson_collection, f, indent=2, ensure_ascii=False)
    print(f"\nGeoJSON saved: {geojson_path}")

    # Save ways JSON
    ways_path = Path(args.output_dir) / f"{slug}_ways.json"
    with open(ways_path, "w", encoding="utf-8") as f:
        json.dump(ways_list, f, indent=2, ensure_ascii=False)
    print(f"Ways JSON saved: {ways_path}")

    print("\nDone!")


if __name__ == "__main__":
    main()
