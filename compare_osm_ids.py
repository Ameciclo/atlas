#!/usr/bin/env python3
"""
Script para comparar osm_id entre ways.csv e ways.geojson
"""

import csv
import json
import sys

def extract_osm_ids_from_csv(csv_file):
    """Extrai osm_id do arquivo CSV"""
    osm_ids = set()
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                if 'osm_id' in row and row['osm_id']:
                    osm_ids.add(int(row['osm_id']))
    except Exception as e:
        print(f"Erro ao ler CSV: {e}")
        return set()
    return osm_ids

def extract_osm_ids_from_geojson(geojson_file):
    """Extrai osm_id do arquivo GeoJSON"""
    osm_ids = set()
    try:
        with open(geojson_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        for feature in data.get('features', []):
            properties = feature.get('properties', {})
            osm_id = properties.get('@id', '')
            
            # Extrai o número do ID (formato: "way/123456" ou "relation/123456")
            if osm_id.startswith(('way/', 'relation/')):
                try:
                    numeric_id = int(osm_id.split('/')[-1])
                    osm_ids.add(numeric_id)
                except ValueError:
                    continue
                    
    except Exception as e:
        print(f"Erro ao ler GeoJSON: {e}")
        return set()
    return osm_ids

def main():
    csv_file = '/home/dvalenca/code/atlas/apps/cycling-infra/src/db/ways.csv'
    geojson_file = '/home/dvalenca/code/atlas/apps/cycling-infra/src/db/ways.geojson'
    
    print("Extraindo osm_id do ways.csv...")
    csv_ids = extract_osm_ids_from_csv(csv_file)
    print(f"Encontrados {len(csv_ids)} IDs únicos no CSV")
    
    print("\nExtraindo osm_id do ways.geojson...")
    geojson_ids = extract_osm_ids_from_geojson(geojson_file)
    print(f"Encontrados {len(geojson_ids)} IDs únicos no GeoJSON")
    
    # Comparação
    print("\n" + "="*50)
    print("COMPARAÇÃO DOS OSM_IDs")
    print("="*50)
    
    # IDs presentes em ambos
    common_ids = csv_ids.intersection(geojson_ids)
    print(f"IDs presentes em ambos os arquivos: {len(common_ids)}")
    
    # IDs apenas no CSV
    csv_only = csv_ids - geojson_ids
    print(f"IDs apenas no CSV: {len(csv_only)}")
    if csv_only:
        print("Primeiros 10 IDs apenas no CSV:", sorted(list(csv_only))[:10])
    
    # IDs apenas no GeoJSON
    geojson_only = geojson_ids - csv_ids
    print(f"IDs apenas no GeoJSON: {len(geojson_only)}")
    if geojson_only:
        print("Primeiros 10 IDs apenas no GeoJSON:", sorted(list(geojson_only))[:10])
    
    # Estatísticas
    total_unique = len(csv_ids.union(geojson_ids))
    print(f"\nTotal de IDs únicos (união): {total_unique}")
    
    if csv_ids and geojson_ids:
        coverage_csv = len(common_ids) / len(csv_ids) * 100
        coverage_geojson = len(common_ids) / len(geojson_ids) * 100
        print(f"Cobertura CSV->GeoJSON: {coverage_csv:.1f}%")
        print(f"Cobertura GeoJSON->CSV: {coverage_geojson:.1f}%")
    
    # Verificação de consistência
    print(f"\n{'✓' if len(csv_only) == 0 and len(geojson_only) == 0 else '✗'} Todos os osm_id estão presentes em ambos os arquivos")

if __name__ == "__main__":
    main()