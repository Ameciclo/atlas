#!/usr/bin/env python3
import json
import math
import requests
import time
import re
from typing import Set, List, Dict

def load_ciclomapa_osm_ids(geojson_file: str) -> Set[int]:
    """Extrai OSM IDs do arquivo GeoJSON do ciclomapa"""
    with open(geojson_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    osm_ids = set()
    for feature in data['features']:
        osm_id = feature['id']
        # Extrai número do formato "way/590791005"
        match = re.search(r'way/(\d+)', osm_id)
        if match:
            osm_ids.add(int(match.group(1)))
    
    return osm_ids

def load_processed_osm_ids(processed_file: str) -> Set[int]:
    """Carrega OSM IDs já processados"""
    try:
        with open(processed_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return {item['osm_id'] for item in data}
    except FileNotFoundError:
        return set()

def fetch_osm_way(way_id: int) -> Dict:
    """Busca dados de um way específico via Overpass API"""
    query = f"""
    [out:json][timeout:25];
    (
      way({way_id});
    );
    out geom;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    
    try:
        response = requests.post(url, data=query, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Erro ao buscar way {way_id}: {e}")
        return None

# Cyclist infrastructure types matching ciclomapa's layers.json
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

def process_osm_data(osm_data: Dict, way_id: int, city_id: int = 2611606) -> Dict:
    """Processa dados OSM para formato esperado"""
    if not osm_data or 'elements' not in osm_data or not osm_data['elements']:
        return None
    
    way = osm_data['elements'][0]
    
    # Calcula comprimento usando Haversine
    coords = way.get('geometry', [])
    length = calculate_length(coords)
    
    tags = way.get('tags', {})
    
    # Tipologia expandida
    typology = classify_typology(tags)
    has_cycleway = typology in CYCLING_TYPES
    
    # dual_carriageway
    dual_carriageway = tags.get('dual_carriageway') == 'yes'
    if dual_carriageway:
        length = length / 2
    
    # Converte para GeoJSON
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

def main():
    # Arquivos
    ciclomapa_file = "ciclomapa-Recife, Pernambuco, Brasil.geojson"
    processed_file = "processed_ways.json"
    output_file = "ciclomapa_ways_data.json"
    failed_file = "failed_downloads.json"
    
    print("Carregando OSM IDs do ciclomapa...")
    ciclomapa_ids = load_ciclomapa_osm_ids(ciclomapa_file)
    print(f"Encontrados {len(ciclomapa_ids)} OSM IDs no ciclomapa")
    
    print("Carregando OSM IDs já processados...")
    processed_ids = load_processed_osm_ids(processed_file)
    print(f"Já processados: {len(processed_ids)} OSM IDs")
    
    # IDs faltantes
    missing_ids = ciclomapa_ids - processed_ids
    print(f"Faltam baixar: {len(missing_ids)} OSM IDs")
    
    if not missing_ids:
        print("Todos os OSM IDs já foram processados!")
        return
    
    # Baixar dados faltantes
    downloaded_data = []
    failed_downloads = []
    
    for i, way_id in enumerate(sorted(missing_ids), 1):
        print(f"Baixando {i}/{len(missing_ids)}: way/{way_id}")
        
        osm_data = fetch_osm_way(way_id)
        if osm_data:
            processed = process_osm_data(osm_data, way_id)
            if processed:
                downloaded_data.append(processed)
            else:
                failed_downloads.append({"osm_id": way_id, "reason": "processing_failed"})
        else:
            failed_downloads.append({"osm_id": way_id, "reason": "download_failed"})
        
        # Rate limiting
        time.sleep(1)
        
        # Salva progresso a cada 10 items
        if i % 10 == 0:
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(downloaded_data, f, indent=2, ensure_ascii=False)
            print(f"Progresso salvo: {len(downloaded_data)} baixados")
    
    # Salva resultados finais
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(downloaded_data, f, indent=2, ensure_ascii=False)
    
    with open(failed_file, 'w', encoding='utf-8') as f:
        json.dump(failed_downloads, f, indent=2, ensure_ascii=False)
    
    print(f"\nConcluído!")
    print(f"Baixados com sucesso: {len(downloaded_data)}")
    print(f"Falhas: {len(failed_downloads)}")
    print(f"Dados salvos em: {output_file}")
    print(f"Falhas salvas em: {failed_file}")

if __name__ == "__main__":
    main()