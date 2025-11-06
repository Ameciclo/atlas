#!/usr/bin/env python3
import json
import requests
import time
from pathlib import Path

def fetch_relation_ways(relation_id):
    """Fetch ways from a relation using Overpass API"""
    overpass_url = "http://overpass-api.de/api/interpreter"
    
    query = f"""
    [out:json][timeout:60];
    (
      relation({relation_id});
      way(r);
    );
    out geom;
    """
    
    try:
        response = requests.post(overpass_url, data=query, timeout=120)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching relation {relation_id}: {e}")
        return None

def main():
    failed_ids = [
        "16000037", "15997435", "16005000", "16006336", "16000467", "15997439", 
        "15997447", "16001874", "16001884", "16002114", "16002174", "16006390", 
        "16002173", "16002257", "15997450", "16001889", "16002170", "15997692", 
        "15997693", "15997691", "15997700", "15997458", "15997457", "15997467"
    ]
    
    existing_file = Path("osm_ways_data.json")
    output_file = Path("osm_ways_data_complete.json")
    
    # Load existing data
    existing_ways = []
    if existing_file.exists():
        with open(existing_file, 'r') as f:
            existing_ways = json.load(f)
        print(f"Loaded {len(existing_ways)} existing ways")
    
    print(f"Retrying {len(failed_ids)} failed relations...")
    
    for i, relation_id in enumerate(failed_ids, 1):
        print(f"Fetching relation {relation_id} ({i}/{len(failed_ids)})...")
        
        data = fetch_relation_ways(relation_id)
        if data:
            ways = [element for element in data['elements'] if element['type'] == 'way']
            
            # Add relation_id to each way
            for way in ways:
                way['relation_id'] = relation_id
                existing_ways.append(way)
            
            print(f"  Found {len(ways)} ways")
        else:
            print(f"  Failed to fetch relation {relation_id}")
        
        # Rate limiting - longer delay for retries
        time.sleep(2)
    
    print(f"Saving complete data to {output_file}...")
    with open(output_file, 'w') as f:
        json.dump(existing_ways, f, indent=2)
    
    print(f"Done! Total ways: {len(existing_ways)}")

if __name__ == "__main__":
    main()