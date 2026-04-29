#!/usr/bin/env python3
import json
import requests
import time
from pathlib import Path

def extract_relation_ids(geojson_file):
    """Extract relation IDs from GeoJSON file"""
    with open(geojson_file, 'r') as f:
        data = json.load(f)
    
    relation_ids = []
    for feature in data['features']:
        osm_id = feature['properties']['@id']
        if osm_id.startswith('relation/'):
            relation_id = osm_id.split('/')[1]
            relation_ids.append(relation_id)
    
    return relation_ids

def fetch_relation_ways(relation_id):
    """Fetch ways from a relation using Overpass API"""
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    query = f"""
    [out:json][timeout:25];
    (
      relation({relation_id});
      way(r);
    );
    out geom;
    """
    
    try:
        response = requests.post(overpass_url, data=query)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching relation {relation_id}: {e}")
        return None

def main():
    geojson_file = Path("ways.geojson")
    output_file = Path("osm_ways_data.json")
    
    if not geojson_file.exists():
        print(f"File {geojson_file} not found")
        return
    
    print("Extracting relation IDs...")
    relation_ids = extract_relation_ids(geojson_file)
    print(f"Found {len(relation_ids)} relations")
    
    all_ways_data = []
    
    for i, relation_id in enumerate(relation_ids, 1):
        print(f"Fetching relation {relation_id} ({i}/{len(relation_ids)})...")
        
        data = fetch_relation_ways(relation_id)
        if data:
            ways = [element for element in data['elements'] if element['type'] == 'way']
            
            # Add relation_id to each way
            for way in ways:
                way['relation_id'] = relation_id
                all_ways_data.append(way)
            
            print(f"  Found {len(ways)} ways")
        
        # Rate limiting
        time.sleep(1)
    
    print(f"Saving data to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(all_ways_data, f, indent=2)
    
    print(f"Done! Processed {len(all_ways_data)} ways from {len(relation_ids)} relations")

if __name__ == "__main__":
    main()