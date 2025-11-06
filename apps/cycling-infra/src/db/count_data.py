#!/usr/bin/env python3
import json
from pathlib import Path

def main():
    # Check which file exists
    files_to_check = ["osm_ways_data_final.json", "osm_ways_data_complete.json", "osm_ways_data.json"]
    
    data_file = None
    for file_name in files_to_check:
        if Path(file_name).exists():
            data_file = Path(file_name)
            break
    
    if not data_file:
        print("No data file found!")
        return
    
    print(f"Reading data from: {data_file}")
    
    with open(data_file, 'r') as f:
        ways_data = json.load(f)
    
    # Count ways
    total_ways = len(ways_data)
    
    # Count unique relations
    relation_ids = set()
    for way in ways_data:
        if 'relation_id' in way:
            relation_ids.add(way['relation_id'])
    
    total_relations = len(relation_ids)
    
    print(f"\n📊 Dataset Summary:")
    print(f"   Ways: {total_ways:,}")
    print(f"   Relations: {total_relations}")
    print(f"   Average ways per relation: {total_ways/total_relations:.1f}")
    
    # Show relation breakdown
    relation_counts = {}
    for way in ways_data:
        rel_id = way.get('relation_id', 'unknown')
        relation_counts[rel_id] = relation_counts.get(rel_id, 0) + 1
    
    print(f"\n🔢 Top 5 relations by way count:")
    sorted_relations = sorted(relation_counts.items(), key=lambda x: x[1], reverse=True)
    for rel_id, count in sorted_relations[:5]:
        print(f"   Relation {rel_id}: {count} ways")

if __name__ == "__main__":
    main()