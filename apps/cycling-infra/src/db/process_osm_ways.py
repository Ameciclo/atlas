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

def get_typology_from_tags(tags):
    """Extract cycleway typology from OSM tags"""
    if not tags:
        return "none"
    
    # Check for dedicated cycleway
    if tags.get('highway') == 'cycleway':
        return "Ciclovia"
    
    # Check for cycle lanes
    cycleway_tags = ['cycleway', 'cycleway:left', 'cycleway:right', 'cycleway:both']
    for tag in cycleway_tags:
        if tag in tags:
            value = tags[tag]
            if value in ['lane', 'track']:
                return "Ciclofaixa"
            elif value in ['shared_lane', 'shared']:
                return "Ciclofaixa Compartilhada"
    
    # Check for bicycle designation
    if tags.get('bicycle') == 'designated':
        return "Ciclovia"
    
    return "none"

def has_cycleway_infrastructure(typology):
    """Check if way has cycling infrastructure"""
    return typology != "none"

def get_city_by_point(lat, lon):
    """Determine city based on coordinates (simplified)"""
    # Default to Recife for RMR area
    # This should be replaced with proper point-in-polygon check
    if -8.2 <= lat <= -7.9 and -35.1 <= lon <= -34.8:
        return 2611606  # Recife
    return 2607208  # Default fallback

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
    
    # Get city (using middle point of geometry)
    city_id = 2611606  # Default to Recife
    if geometry:
        middle_idx = len(geometry) // 2
        middle_point = geometry[middle_idx]
        city_id = get_city_by_point(middle_point['lat'], middle_point['lon'])
    
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