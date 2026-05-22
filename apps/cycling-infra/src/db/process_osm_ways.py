#!/usr/bin/env python3
import json
import math
from pathlib import Path
from datetime import datetime

def calculate_length(geometry):
    """Calculate length of a way using Haversine formula"""
    if not geometry or len(geometry) < 2:
        return 0
    
    total_length = 0
    for i in range(len(geometry) - 1):
        lat1, lon1 = geometry[i]['lat'], geometry[i]['lon']
        lat2, lon2 = geometry[i + 1]['lat'], geometry[i + 1]['lon']
        total_length += haversine_distance(lat1, lon1, lat2, lon2)
    
    return total_length / 1000  # Convert to km

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two points using Haversine formula"""
    R = 6371000  # Earth radius in meters
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

# Cyclist infrastructure types matching ciclomapa's layers.json
CYCLING_TYPES = {"Ciclovia", "Ciclofaixa", "Ciclorrota", "Calçada compartilhada"}

def get_typology_from_tags(tags):
    """Extract cycleway typology from OSM tags, matching ciclomapa's classification."""
    if not tags:
        return "none"

    # highway=cycleway is always Ciclovia
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

    # footway/pedestrian + bicycle=designated/yes = Calçada compartilhada
    highway = tags.get('highway')
    bicycle = tags.get('bicycle')
    if highway in ('footway', 'pedestrian') and bicycle in ('designated', 'yes'):
        return "Calçada compartilhada"

    # bicycle=designated on any highway
    if bicycle == 'designated':
        return "Ciclovia"

    return "none"

def has_cycleway_infrastructure(typology):
    """Check if way has cycling infrastructure"""
    return typology in CYCLING_TYPES

def get_city_by_point(lat, lon, city_id=2611606):
    """Return city_id (now accepts it from data, no longer does bbox guess)"""
    return city_id

def process_way(way_data):
    """Process a single way and extract required fields"""
    tags = way_data.get('tags', {})
    geometry = way_data.get('geometry', [])
    
    # Calculate length
    length = calculate_length(geometry)
    
    # Check for dual carriageway
    dual_carriageway = tags.get('dual_carriageway') == 'yes'
    if dual_carriageway:
        length = length / 2
    
    # Get typology
    typology = get_typology_from_tags(tags)
    
    # Get city from data (already assigned by fetch script)
    city_id = get_city_by_point(
        None, None,
        way_data.get('city_id', 2611606)
    )
    
    # Create GeoJSON
    coordinates = [[point['lon'], point['lat']] for point in geometry]
    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "id": f"way/{way_data['id']}",
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": coordinates
            },
            "properties": {
                "id": f"way/{way_data['id']}",
                **tags
            }
        }]
    }
    
    return {
        "osm_id": way_data['id'],
        "name": tags.get('name', ''),
        "length": length,
        "highway": tags.get('highway', ''),
        "has_cycleway": has_cycleway_infrastructure(typology),
        "cycleway_typology": typology,
        "relation_id": way_data.get('relation_id', 0),
        "geojson": json.dumps(geojson),
        "lastupdated": datetime.now().isoformat(),
        "city_id": city_id,
        "dual_carriageway": dual_carriageway,
        "pdc_typology": "Ciclovia" if way_data.get('relation_id', 0) != 0 else "notOnPDC"
    }

def main():
    # Try final file first, then complete, then original
    input_files = ["osm_ways_data_final.json", "osm_ways_data_complete.json", "osm_ways_data.json"]
    input_file = None
    
    for file_name in input_files:
        if Path(file_name).exists():
            input_file = Path(file_name)
            break
    
    output_file = Path("processed_ways.json")
    
    if not input_file.exists():
        print(f"File {input_file} not found")
        return
    
    print("Loading OSM ways data...")
    with open(input_file, 'r') as f:
        ways_data = json.load(f)
    
    print(f"Processing {len(ways_data)} ways...")
    processed_ways = []
    
    for i, way in enumerate(ways_data, 1):
        if i % 100 == 0:
            print(f"Processed {i}/{len(ways_data)} ways...")
        
        try:
            processed_way = process_way(way)
            processed_ways.append(processed_way)
        except Exception as e:
            print(f"Error processing way {way.get('id', 'unknown')}: {e}")
    
    print(f"Saving processed data to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(processed_ways, f, indent=2)
    
    print(f"Done! Processed {len(processed_ways)} ways")

if __name__ == "__main__":
    main()