#!/usr/bin/env python3
import json
import requests
import time
from pathlib import Path

def fetch_relation_ways(relation_id):
    """Fetch ways from a relation using Overpass API with extended timeout"""
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    query = f"""
    [out:json][timeout:120];
    (
      relation({relation_id});
      way(r);
    );
    out geom;
    """
    
    try:
        print(f"  Querying Overpass API...")
        response = requests.post(overpass_url, data=query, timeout=180)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"  Error: {e}")
        return None

def main():
    final_failed_ids = ["16000037", "16001874", "16002173"]
    
    existing_file = Path("osm_ways_data_complete.json")
    output_file = Path("osm_ways_data_final.json")
    
    # Load existing data
    existing_ways = []
    if existing_file.exists():
        with open(existing_file, 'r') as f:
            existing_ways = json.load(f)
        print(f"Loaded {len(existing_ways)} existing ways")
    
    print(f"Retrying final {len(final_failed_ids)} relations...")
    
    for i, relation_id in enumerate(final_failed_ids, 1):
        print(f"Fetching relation {relation_id} ({i}/{len(final_failed_ids)})...")
        
        data = fetch_relation_ways(relation_id)
        if data:
            ways = [element for element in data['elements'] if element['type'] == 'way']
            
            # Add relation_id to each way
            for way in ways:
                way['relation_id'] = relation_id
                existing_ways.append(way)
            
            print(f"  ✓ Found {len(ways)} ways")
        else:
            print(f"  ✗ Failed to fetch relation {relation_id}")
        
        # Extended rate limiting
        if i < len(final_failed_ids):
            print(f"  Waiting 5 seconds...")
            time.sleep(5)
    
    print(f"Saving final data to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(existing_ways, f, indent=2)
    
    print(f"Done! Total ways: {len(existing_ways)}")

if __name__ == "__main__":
    main()