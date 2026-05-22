#!/usr/bin/env python3
"""
Fetch cycling infrastructure ways that lie on or near city borders.

Uses Overpass to query within 20m of municipal boundary lines, catching ways
that the per-city area(a) query misses (border ways whose nodes are on the
administrative boundary line rather than strictly inside either municipality).

For each new way found, assigns city_id via point-in-polygon against the
municipal boundaries from pe_limites_municipais.geojson, then merges into
non_pdc_ways.json.

Usage:
  python3 fetch_border_ways.py [--endpoint URL]
"""
import json
import math
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

DB_DIR = Path(__file__).parent

OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

DEFAULT_USER_AGENT = "cycling-infra-atlas/1.0"

# Bounding box covering the Recife Metropolitan Region (RMR)
# Approximately -8.25 to -7.75 lat, -35.25 to -34.75 lon
RMR_BBOX = (-8.25, -35.25, -7.75, -34.75)

# Filters matching fetch_city_cycling_infra.py EXACTLY
INFRA_FILTERS = [
    ("Ciclovia", ["highway", "cycleway"]),
    ("Ciclovia", ["cycleway", "track"]),
    ("Ciclovia", ["cycleway:left", "track"]),
    ("Ciclovia", ["cycleway:right", "track"]),
    ("Ciclovia", ["cycleway", "opposite_track"]),
    ("Ciclovia", ["cycleway:left", "opposite_track"]),
    ("Ciclovia", ["cycleway:right", "opposite_track"]),
    ("Calçada compartilhada", [["highway", "footway"], ["bicycle", "designated"]]),
    ("Calçada compartilhada", [["highway", "pedestrian"], ["bicycle", "designated"]]),
    ("Calçada compartilhada", [["highway", "pedestrian"], ["bicycle", "yes"]]),
    ("Calçada compartilhada", ["cycleway", "sidepath"]),
    ("Calçada compartilhada", ["cycleway:left", "sidepath"]),
    ("Calçada compartilhada", ["cycleway:right", "sidepath"]),
    ("Ciclofaixa", ["cycleway", "lane"]),
    ("Ciclofaixa", ["cycleway:left", "lane"]),
    ("Ciclofaixa", ["cycleway:right", "lane"]),
    ("Ciclofaixa", ["cycleway:both", "lane"]),
    ("Ciclofaixa", ["cycleway", "opposite_lane"]),
    ("Ciclofaixa", ["cycleway:left", "opposite_lane"]),
    ("Ciclofaixa", ["cycleway:right", "opposite_lane"]),
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

CYCLING_TYPES = {"Ciclovia", "Ciclofaixa", "Ciclorrota", "Calçada compartilhada"}


def build_overpass_query():
    """Build Overpass query that finds cycling infra near all RMR municipal boundaries."""
    lines = ["[out:json][timeout:500];"]

    # Get all admin_level=8 boundary relations within RMR bbox
    lines.append(
        f"rel['boundary'='administrative']['admin_level'='8']"
        f"({RMR_BBOX[0]},{RMR_BBOX[1]},{RMR_BBOX[2]},{RMR_BBOX[3]})->.cities;"
    )
    # Get the ways that form those boundaries
    lines.append("way(r.cities)->.border_ways;")

    # Query each infra filter near the border ways
    lines.append("(")
    for layer_name, filter_parts in INFRA_FILTERS:
        if isinstance(filter_parts[0], list):
            tag_str = "".join(f'["{k}"="{v}"]' for k, v in filter_parts)
            lines.append(f'  way{tag_str}(around.border_ways:20);')
        else:
            lines.append(
                f'  way["{filter_parts[0]}"="{filter_parts[1]}"]'
                f"(around.border_ways:20);"
            )
    lines.append(");")
    lines.append("out body geom;")
    return "\n".join(lines)


def execute_query(query, endpoint=None, timeout=300):
    servers = [endpoint] if endpoint else OVERPASS_SERVERS
    last_error = None
    for srv in servers:
        try:
            resp = requests.post(
                srv, data=query,
                headers={"User-Agent": DEFAULT_USER_AGENT},
                timeout=timeout,
            )
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            last_error = e
            continue
    raise RuntimeError(f"All Overpass servers failed: {last_error}")


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
        lat1, lon1 = coords[i]["lat"], coords[i]["lon"]
        lat2, lon2 = coords[i + 1]["lat"], coords[i + 1]["lon"]
        total += haversine_distance(lat1, lon1, lat2, lon2)
    return total / 1000


def classify_tags(tags):
    if not tags:
        return "Ciclorrota"
    if tags.get("highway") == "cycleway":
        return "Ciclovia"
    cycleway_keys = ["cycleway", "cycleway:left", "cycleway:right", "cycleway:both"]
    for key in cycleway_keys:
        val = tags.get(key)
        if val in ("track", "opposite_track"):
            return "Ciclovia"
        if val in ("sidepath",):
            return "Calçada compartilhada"
        if val in ("lane", "opposite_lane"):
            return "Ciclofaixa"
        if val in ("shared_lane", "buffered_lane", "share_busway", "opposite_share_busway"):
            return "Ciclorrota"
    highway = tags.get("highway")
    bicycle = tags.get("bicycle")
    if highway in ("footway", "pedestrian") and bicycle in ("designated", "yes"):
        return "Calçada compartilhada"
    if highway == "cycleway":
        return "Ciclovia"
    if bicycle == "designated":
        return "Ciclovia"
    return "Ciclorrota"


def point_in_polygon(lon, lat, polygon):
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


def point_in_multipolygon(lon, lat, multipolygon):
    for polygon_coords in multipolygon:
        exterior_ring = polygon_coords[0]
        if point_in_polygon(lon, lat, exterior_ring):
            return True
    return False


def centroid_of_linestring(coordinates):
    n = len(coordinates)
    if n == 0:
        return None
    lon_sum = sum(c[0] for c in coordinates)
    lat_sum = sum(c[1] for c in coordinates)
    return (lon_sum / n, lat_sum / n)


def load_boundaries():
    """Load municipal boundaries from GeoJSON."""
    path = DB_DIR / "pe_limites_municipais.geojson"
    with open(path) as f:
        data = json.load(f)
    boundaries = []
    for feature in data["features"]:
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
    return boundaries


def find_city_id(lon, lat, boundaries):
    """Find which city boundary contains the point. Returns city_id or None."""
    for city_id, name, multipolygon in boundaries:
        if point_in_multipolygon(lon, lat, multipolygon):
            return city_id
    return None


def process_elements(elements):
    """Convert OSM elements to the same format as fetch_city_cycling_infra.py."""
    ways_list = []
    seen_osm_ids = set()

    for el in elements:
        if el.get("type") != "way":
            continue

        osm_id = el["id"]
        if osm_id in seen_osm_ids:
            continue
        seen_osm_ids.add(osm_id)

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
        pdc_typology = "Ciclovia" if (rel_id and rel_id != 0) else "notOnPDC"

        coordinates = [[p["lon"], p["lat"]] for p in geometry]

        geojson_feature = {
            "id": f"way/{osm_id}",
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coordinates},
            "properties": {
                "id": f"way/{osm_id}",
                "name": tags.get("name", ""),
                "type": typology,
                **tags,
            },
        }

        way_entry = {
            "osm_id": osm_id,
            "name": tags.get("name", ""),
            "length": round(length, 7),
            "highway": tags.get("highway", ""),
            "has_cycleway": True,
            "cycleway_typology": typology,
            "relation_id": rel_id,
            "geojson": json.dumps({
                "type": "FeatureCollection",
                "features": [geojson_feature],
            }),
            "lastupdated": datetime.now().isoformat(),
            "city_id": None,
            "dual_carriageway": dual_carriageway,
            "pdc_typology": pdc_typology,
        }

        ways_list.append(way_entry)

    return ways_list


def main():
    endpoint = None
    if "--endpoint" in sys.argv:
        idx = sys.argv.index("--endpoint")
        endpoint = sys.argv[idx + 1]

    print("=" * 60)
    print("Fetching border cycling infrastructure via Overpass")
    print("=" * 60)

    # Build and execute query
    query = build_overpass_query()
    print(f"\nQuery length: {len(query)} chars")

    print("Executing Overpass query...")
    osm_data = execute_query(query, endpoint)
    elements = osm_data.get("elements", [])
    print(f"Received {len(elements)} OSM elements")

    if not elements:
        print("No data returned.")
        sys.exit(0)

    # Process elements
    fetched_ways = process_elements(elements)
    print(f"Found {len(fetched_ways)} ways with cycling infrastructure")

    # Load boundaries for point-in-polygon
    print("\nLoading municipal boundaries...")
    boundaries = load_boundaries()
    print(f"Loaded {len(boundaries)} municipal boundaries")

    # Load existing non_pdc_ways.json
    non_pdc_path = DB_DIR / "non_pdc_ways.json"
    print(f"\nLoading existing non_pdc_ways.json...")
    with open(non_pdc_path) as f:
        existing_ways = json.load(f)
    existing_ids = {w["osm_id"] for w in existing_ways}
    print(f"Existing: {len(existing_ways)} ways")

    # For each new way, assign city_id via point-in-polygon
    new_ways = []
    for w in fetched_ways:
        if w["osm_id"] in existing_ids:
            continue

        # Parse GeoJSON to get centroid
        try:
            geojson_data = json.loads(w["geojson"])
            geometry = geojson_data["features"][0]["geometry"]
            coords = geometry["coordinates"]
            if geometry["type"] == "MultiLineString":
                flat_coords = [c for seg in coords for c in seg]
            else:
                flat_coords = coords
            centroid = centroid_of_linestring(flat_coords)
            if centroid is None:
                continue
            lon, lat = centroid
        except (KeyError, IndexError, json.JSONDecodeError):
            continue

        # Find city
        city_id = find_city_id(lon, lat, boundaries)
        if city_id is None:
            # Try a larger fallback with multi-ring search
            # (for ways exactly on the boundary, try adjacent boundary buffer)
            print(f"  ⚠️ way/{w['osm_id']} ({w['name']}): centroid not in any polygon")
            # Fallback: find nearest city by centroid distance
            nearest = None
            nearest_dist = float("inf")
            for city_id_b, name_b, multipolygon_b in boundaries:
                # Compute city polygon centroid
                poly = multipolygon_b[0][0]
                cx = sum(p[0] for p in poly) / len(poly)
                cy = sum(p[1] for p in poly) / len(poly)
                dist = math.sqrt((lon - cx) ** 2 + (lat - cy) ** 2)
                if dist < nearest_dist:
                    nearest_dist = dist
                    nearest = city_id_b
            if nearest and nearest_dist < 0.5:
                city_id = nearest
                print(f"    → assigned to {nearest} (nearest city, {nearest_dist:.4f}°)")
            else:
                print(f"    → SKIPPED (nearest too far: {nearest_dist:.4f}°)")
                continue

        w["city_id"] = city_id
        new_ways.append(w)

    print(f"\nNew border ways to add: {len(new_ways)}")

    if not new_ways:
        print("No new ways to add.")
        return

    # Show summary
    by_city = {}
    for w in new_ways:
        cid = w["city_id"]
        by_city[cid] = by_city.get(cid, 0) + w.get("length", 0)

    for city_id, km in sorted(by_city.items(), key=lambda x: -x[1]):
        city_name = next(
            (n for c, n in [
                (2600054, "Abreu e Lima"), (2601052, "Araçoiaba"),
                (2602902, "Cabo"), (2603454, "Camaragibe"),
                (2606804, "Igarassu"), (2607208, "Ipojuca"),
                (2607604, "Itamaracá"), (2607752, "Itapissuma"),
                (2607901, "Jaboatão"), (2609402, "Moreno"),
                (2609600, "Olinda"), (2610707, "Paulista"),
                (2611606, "Recife"), (2613701, "São Lourenço"),
            ] if c == city_id),
            str(city_id),
        )
        count = sum(1 for w in new_ways if w["city_id"] == city_id)
        print(f"  {city_name:20s}: {count:3d} ways, {km:.2f} km")

    # Merge into non_pdc_ways.json
    print(f"\nMerging into {non_pdc_path}...")
    existing_ways.extend(new_ways)
    with open(non_pdc_path, "w", encoding="utf-8") as f:
        json.dump(existing_ways, f, indent=2, ensure_ascii=False)

    total_km = sum(w.get("length", 0) for w in new_ways)
    print(f"✅ Added {len(new_ways)} border ways ({total_km:.2f} km)")
    print(f"   non_pdc_ways.json now has {len(existing_ways)} ways")


if __name__ == "__main__":
    main()
