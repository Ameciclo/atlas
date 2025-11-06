#!/usr/bin/env python3
import json
import csv
from pathlib import Path

def main():
    input_file = Path("processed_ways.json")
    output_file = Path("ways_processed.csv")
    
    if not input_file.exists():
        print(f"File {input_file} not found")
        return
    
    print("Loading processed ways data...")
    with open(input_file, 'r') as f:
        ways_data = json.load(f)
    
    print(f"Converting {len(ways_data)} ways to CSV...")
    
    fieldnames = [
        "osm_id", "name", "length", "highway", "has_cycleway", 
        "cycleway_typology", "relation_id", "geojson", "lastupdated", 
        "city_id", "dual_carriageway", "pdc_typology"
    ]
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames, quoting=csv.QUOTE_ALL)
        writer.writeheader()
        
        for way in ways_data:
            writer.writerow(way)
    
    print(f"CSV saved to {output_file}")

if __name__ == "__main__":
    main()