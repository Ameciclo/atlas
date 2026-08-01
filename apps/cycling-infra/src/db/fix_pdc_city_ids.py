#!/usr/bin/env python3
"""
Fix city_id in pdc_ways.json using municipal boundaries from pe_limites_municipais.geojson.

For each way, extracts the centroid of its LineString geometry and performs a
point-in-polygon test against each municipal boundary. Updates city_id based on
which municipality contains the centroid.

Usage:
    python3 fix_pdc_city_ids.py [--dry-run]

Dependencies: none (pure Python, uses ray casting algorithm)
"""
import json
import math
import sys
from pathlib import Path

DB_DIR = Path(__file__).parent


def point_in_polygon(lon, lat, polygon):
    """Ray casting algorithm: returns True if point (lon, lat) is inside polygon."""
    inside = False
    n = len(polygon)
    j = n - 1
    for i in range(n):
        xi, yi = polygon[i]
        xj, yj = polygon[j]
        # Check if the point is between the y-coordinates of the edge
        if ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / (yj - yi) + xi
        ):
            inside = not inside
        j = i
    return inside


def point_in_multipolygon(lon, lat, multipolygon):
    """Check if point is inside any polygon in a MultiPolygon."""
    for polygon_coords in multipolygon:
        # A polygon can have exterior ring + holes (interior rings)
        # We check the exterior ring (first coord list) and ignore holes
        # for point-in-polygon purposes (a centroid inside a hole is still
        # within the municipality boundary polygon)
        exterior_ring = polygon_coords[0]
        if point_in_polygon(lon, lat, exterior_ring):
            return True
    return False


def centroid_of_linestring(coordinates):
    """Compute centroid of a LineString from its coordinates (average of all points)."""
    n = len(coordinates)
    if n == 0:
        return None
    lon_sum = sum(c[0] for c in coordinates)
    lat_sum = sum(c[1] for c in coordinates)
    return (lon_sum / n, lat_sum / n)


def load_boundaries():
    """Load municipal boundaries from GeoJSON and return list of (city_id, name, multipolygon_coords)."""
    boundaries_path = DB_DIR / "pe_limites_municipais.geojson"
    print(f"Loading municipal boundaries from {boundaries_path}...")
    with open(boundaries_path) as f:
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
            print(f"  ⚠️ Skipping {name}: unsupported geometry type {geometry['type']}")
            continue
        boundaries.append((city_id, name, coords))
    return boundaries


def fix_city_ids(ways, boundaries):
    """Fix city_ids in a list of ways using point-in-polygon test."""
    fixed = 0
    unchanged = 0
    not_found = 0
    changes = {}

    for way in ways:
        old_city_id = way.get("city_id", 2611606)

        geojson_str = way.get("geojson", "{}")
        try:
            geojson_data = json.loads(geojson_str)
        except json.JSONDecodeError:
            not_found += 1
            continue

        features = geojson_data.get("features", [])
        if not features:
            not_found += 1
            continue

        geometry = features[0].get("geometry", {})
        if geometry.get("type") not in ("LineString", "MultiLineString"):
            not_found += 1
            continue

        coords = geometry.get("coordinates", [])
        if geometry["type"] == "MultiLineString":
            flat_coords = [c for segment in coords for c in segment]
        else:
            flat_coords = coords

        centroid = centroid_of_linestring(flat_coords)
        if centroid is None:
            not_found += 1
            continue

        lon, lat = centroid

        matched_city_id = None
        for city_id, name, multipolygon in boundaries:
            if point_in_multipolygon(lon, lat, multipolygon):
                matched_city_id = city_id
                break

        if matched_city_id is None:
            not_found += 1
            continue

        if matched_city_id != old_city_id:
            key = f"{old_city_id} -> {matched_city_id}"
            changes[key] = changes.get(key, 0) + 1
            way["city_id"] = matched_city_id
            fixed += 1
        else:
            unchanged += 1

    return fixed, unchanged, not_found, changes


def main():
    dry_run = "--dry-run" in sys.argv

    boundaries = load_boundaries()
    print(f"Loaded {len(boundaries)} municipal boundaries\n")

    # Fix PDC ways
    pdc_path = DB_DIR / "pdc_ways.json"
    print(f"Loading PDC ways from {pdc_path}...")
    with open(pdc_path) as f:
        pdc_ways = json.load(f)
    print(f"Loaded {len(pdc_ways)} ways\n")

    print("--- Fixing PDC ways ---")
    fixed, unchanged, not_found, changes = fix_city_ids(pdc_ways, boundaries)
    print(f"  Unchanged (already correct): {unchanged}")
    print(f"  Fixed:                      {fixed}")
    print(f"  Not found in any boundary:  {not_found}")
    if changes:
        print("  Changes by city:")
        for key, count in sorted(changes.items(), key=lambda x: -x[1]):
            print(f"    {key}: {count} ways")

    if not dry_run and fixed > 0:
        print(f"\n  Writing fixed data to {pdc_path}...")
        with open(pdc_path, "w") as f:
            json.dump(pdc_ways, f, indent=2)
        print("  Done!")
    print()

    # Fix non-PDC ways too
    non_pdc_path = DB_DIR / "non_pdc_ways.json"
    print(f"Loading non-PDC ways from {non_pdc_path}...")
    with open(non_pdc_path) as f:
        non_pdc_ways = json.load(f)
    print(f"Loaded {len(non_pdc_ways)} ways\n")

    print("--- Fixing non-PDC ways ---")
    fixed2, unchanged2, not_found2, changes2 = fix_city_ids(non_pdc_ways, boundaries)
    print(f"  Unchanged (already correct): {unchanged2}")
    print(f"  Fixed:                      {fixed2}")
    print(f"  Not found in any boundary:  {not_found2}")
    if changes2:
        print("  Changes by city:")
        for key, count in sorted(changes2.items(), key=lambda x: -x[1]):
            print(f"    {key}: {count} ways")

    if not dry_run and fixed2 > 0:
        print(f"\n  Writing fixed data to {non_pdc_path}...")
        with open(non_pdc_path, "w") as f:
            json.dump(non_pdc_ways, f, indent=2)
        print("  Done!")
    print()

    total_fixed = fixed + fixed2
    if not dry_run and total_fixed > 0:
        print("✅ All fixes applied successfully!")
    elif dry_run:
        print(f"\n🏁 Dry run complete ({total_fixed} would be fixed total)")
    else:
        print("🏁 No changes needed.")


if __name__ == "__main__":
    main()
