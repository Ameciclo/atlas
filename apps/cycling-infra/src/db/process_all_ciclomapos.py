#!/usr/bin/env python3
import json
import math
import requests
import time
import re
import os
import glob
from typing import Set, List, Dict

# Cycling infrastructure types matching ciclomapa's layers.json
CYCLING_TYPES = {"Ciclovia", "Ciclofaixa", "Ciclorrota", "Calçada compartilhada"}

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
        lat1, lon1 = coords[i]['lat'], coords[i]['lon']
        lat2, lon2 = coords[i+1]['lat'], coords[i+1]['lon']
        total += haversine_distance(lat1, lon1, lat2, lon2)
    return total / 1000


def classify_typology(tags):
    """Classify cycling typology matching ciclomapa's layers.json."""
    if not tags:
        return "Ciclorrota"

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

    highway = tags.get('highway')
    bicycle = tags.get('bicycle')
    if highway in ('footway', 'pedestrian') and bicycle in ('designated', 'yes'):
        return "Calçada compartilhada"
    if bicycle == 'designated':
        return "Ciclovia"

    return "Ciclorrota"

def load_existing_osm_ids() -> Set[int]:
    """Carrega OSM IDs já processados (PDC + non-PDC)"""
    existing_ids = set()
    
    # IDs do PDC
    try:
        with open("pdc_ways.json", 'r', encoding='utf-8') as f:
            pdc_data = json.load(f)
        existing_ids.update(item['osm_id'] for item in pdc_data)
        print(f"PDC IDs: {len(existing_ids)}")
    except FileNotFoundError:
        pass
    
    # IDs do non-PDC
    try:
        with open("non_pdc_ways.json", 'r', encoding='utf-8') as f:
            non_pdc_data = json.load(f)
        existing_ids.update(item['osm_id'] for item in non_pdc_data)
        print(f"Total existing IDs: {len(existing_ids)}")
    except FileNotFoundError:
        pass
    
    return existing_ids

def extract_osm_ids_from_geojson(geojson_file: str) -> Set[int]:
    """Extrai OSM IDs de um arquivo GeoJSON"""
    with open(geojson_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    osm_ids = set()
    cycling_types = ["Ciclovia", "Ciclofaixa", "Ciclorrota", "Calçada compartilhada"]
    
    for feature in data['features']:
        # Só pega LineString de infraestrutura ciclística
        if (feature['geometry']['type'] == 'LineString' and 
            feature['properties'].get('type') in cycling_types):
            
            osm_id = feature['id']
            match = re.search(r'way/(\d+)', osm_id)
            if match:
                osm_ids.add(int(match.group(1)))
    
    return osm_ids

def fetch_osm_way(way_id: int) -> Dict:
    """Busca dados de um way via Overpass API"""
    query = f"""
    [out:json][timeout:60];
    (
      way({way_id});
    );
    out geom;
    """
    
    servers = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter"
    ]
    
    for server in servers:
        try:
            response = requests.post(server, data=query, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            continue
    
    return None

def process_osm_data(osm_data: Dict, way_id: int, city_id: int = 2611606) -> Dict:
    """Processa dados OSM para formato esperado"""
    if not osm_data or 'elements' not in osm_data or not osm_data['elements']:
        return None
    
    way = osm_data['elements'][0]
    coords = way.get('geometry', [])
    
    # Calcula comprimento usando Haversine
    length = calculate_length(coords)
    
    tags = way.get('tags', {})
    
    # Tipologia expandida
    typology = classify_typology(tags)
    has_cycleway = typology in CYCLING_TYPES
    dual_carriageway = tags.get('dual_carriageway') == 'yes'
    if dual_carriageway:
        length = length / 2
    
    # GeoJSON
    geojson = {
        "type": "FeatureCollection",
        "features": [{
            "id": f"way/{way_id}",
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": [[coord['lon'], coord['lat']] for coord in coords]
            },
            "properties": {
                "id": f"way/{way_id}",
                **tags
            }
        }]
    }
    
    return {
        "osm_id": way_id,
        "name": tags.get('name', ''),
        "length": round(length, 7),
        "highway": tags.get('highway', 'unknown'),
        "has_cycleway": has_cycleway,
        "cycleway_typology": typology,
        "relation_id": 0,
        "geojson": json.dumps(geojson),
        "lastupdated": None,
        "city_id": city_id,
        "dual_carriageway": dual_carriageway,
        "pdc_typology": typology
    }

def get_city_id_from_filename(filename: str) -> int:
    """Mapeia nome do arquivo para city_id (IBGE codes corretos)"""
    city_mapping = {
        'Recife': 2611606,
        'Olinda': 2609600,
        'Jaboatão': 2607901,
        'Paulista': 2610707,
        'Camaragibe': 2603454,
        'São Lourenço': 2613701,
        'Abreu e Lima': 2600054,
        'Igarassu': 2606804,
        'Cabo': 2602902,
        'Ipojuca': 2607208,
        'Araçoiaba': 2601052,
        'Itamaracá': 2607604,
        'Itapissuma': 2607752,
        'Moreno': 2609402,
    }
    
    for city_name, city_id in city_mapping.items():
        if city_name.lower() in filename.lower():
            return city_id
    
    return 2611606  # Default Recife

def main():
    print("=== PROCESSANDO TODOS OS CICLOMAPOS ===\n")
    
    # Carrega IDs já existentes
    existing_ids = load_existing_osm_ids()
    
    # Busca todos os arquivos GeoJSON
    geojson_files = [f for f in glob.glob("ciclomapa-*.geojson") if 'Recife' not in f]
    print(f"Arquivos encontrados: {geojson_files}\n")
    
    all_new_data = []
    all_failed = []
    
    for geojson_file in geojson_files:
        print(f"Processando: {geojson_file}")
        city_id = get_city_id_from_filename(geojson_file)
        print(f"City ID: {city_id}")
        
        # Extrai OSM IDs do arquivo
        file_osm_ids = extract_osm_ids_from_geojson(geojson_file)
        print(f"OSM IDs no arquivo: {len(file_osm_ids)}")
        
        # IDs faltantes
        missing_ids = file_osm_ids - existing_ids
        print(f"IDs faltantes: {len(missing_ids)}")
        
        if not missing_ids:
            print("Nenhum ID faltante neste arquivo.\n")
            continue
        
        # Baixa dados faltantes
        for i, way_id in enumerate(sorted(missing_ids), 1):
            print(f"  Baixando {i}/{len(missing_ids)}: way/{way_id}")
            
            osm_data = fetch_osm_way(way_id)
            if osm_data:
                processed = process_osm_data(osm_data, way_id, city_id)
                if processed:
                    all_new_data.append(processed)
                    existing_ids.add(way_id)  # Evita duplicatas
                else:
                    all_failed.append({"osm_id": way_id, "city": geojson_file, "reason": "processing_failed"})
            else:
                all_failed.append({"osm_id": way_id, "city": geojson_file, "reason": "download_failed"})
            
            time.sleep(1)  # Rate limiting
        
        print(f"Arquivo processado: {len(missing_ids)} IDs\n")
    
    # Combina com dados existentes
    try:
        with open("non_pdc_ways.json", 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
    except FileNotFoundError:
        existing_data = []
    
    combined_data = existing_data + all_new_data
    
    # Salva resultados
    with open("non_pdc_ways_complete.json", 'w', encoding='utf-8') as f:
        json.dump(combined_data, f, indent=2, ensure_ascii=False)
    
    with open("failed_all_cities.json", 'w', encoding='utf-8') as f:
        json.dump(all_failed, f, indent=2, ensure_ascii=False)
    
    print(f"=== RESULTADO FINAL ===")
    print(f"Dados existentes: {len(existing_data)}")
    print(f"Novos dados baixados: {len(all_new_data)}")
    print(f"Total combinado: {len(combined_data)}")
    print(f"Falhas: {len(all_failed)}")
    print(f"Arquivo final: non_pdc_ways_complete.json")

if __name__ == "__main__":
    main()