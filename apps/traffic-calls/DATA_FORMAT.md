# Traffic Calls Data Format

This document describes the data format for traffic calls (sinistros) from CTTU and suggests a database schema for storing this data.

## Overview

The traffic calls data comes from CTTU (Autarquia de Trânsito e Transporte Urbano do Recife) and contains records of traffic incidents in Recife from 2016 to 2024.

**Source File:** `src/db/sinistros-cttu-2016-2024-vias-corrigidas.csv`
**Total Records:** ~20,240 incidents

## CSV Structure

The CSV contains 43 columns with detailed information about each traffic incident:

### 1. Temporal Information (2 columns)
- `data` - Date of the incident (YYYY-MM-DD)
- `hora` - Time of the incident (HH:MM:SS)

### 2. Incident Classification (4 columns)
- `natureza_acidente` - Nature: "COM VÍTIMA", "VÍTIMA FATAL", "SEM VÍTIMA"
- `situacao` - Status: "FINALIZADA", etc.
- `tipo` - Type: "COLISÃO", "ATROPELAMENTO", "CAPOTAMENTO", etc.
- `descricao` - Detailed description of the incident

### 3. Location Information (9 columns)
- `bairro` - Neighborhood
- `endereco` - Street address
- `numero` - Street number
- `detalhe_endereco_acidente` - Additional address details
- `complemento` - Address complement
- `endereco_cruzamento` - Cross street address
- `numero_cruzamento` - Cross street number
- `referencia_cruzamento` - Cross street reference
- `bairro_cruzamento` - Cross street neighborhood

### 4. Vehicles Involved (9 columns)
- `auto` - Number of cars
- `moto` - Number of motorcycles
- `ciclom` - Number of motorized bicycles
- `ciclista` - Number of cyclists
- `pedestre` - Number of pedestrians
- `onibus` - Number of buses
- `caminhao` - Number of trucks
- `viatura` - Number of police vehicles
- `outros` - Number of other vehicles

### 5. Victims (2 columns)
- `vitimas` - Total number of victims
- `vitimasfatais` - Number of fatal victims

### 6. Environmental/Road Conditions (13 columns)
- `num_semaforo` - Traffic light number
- `sentido_via` - Direction of the road
- `acidente_verificado` - Whether the accident was verified
- `tempo_clima` - Weather conditions
- `situacao_semaforo` - Traffic light status
- `sinalizacao` - Road signage
- `condicao_via` - Road conditions
- `conservacao_via` - Road conservation status
- `ponto_controle` - Control point
- `situacao_placa` - Sign status
- `velocidade_max_via` - Maximum speed on the road
- `mao_direcao` - Direction of traffic (one-way, two-way)
- `divisao_via1`, `divisao_via2`, `divisao_via3` - Road division types

### 7. Administrative (2 columns)
- `_id` - Original ID from the source system
- `Protocolo` - Protocol number

## Suggested Database Schema

### Design Philosophy

Use a **hybrid approach** combining:
1. **Indexed columns** for frequently queried fields (performance)
2. **JSONB columns** for flexible, nested data (flexibility)

This allows efficient queries while maintaining data integrity and future extensibility.

### Proposed Table: `traffic_calls`

```sql
CREATE TABLE traffic_calls (
  -- Primary Key
  id SERIAL PRIMARY KEY,
  
  -- Temporal (indexed for date range queries)
  datetime TIMESTAMP NOT NULL,
  
  -- Classification (indexed for filtering)
  nature VARCHAR(50) NOT NULL,  -- natureza_acidente
  
  -- Location (indexed for geographic queries)
  street_name VARCHAR(255) NOT NULL,  -- endereco
  neighborhood VARCHAR(100) NOT NULL,  -- bairro
  coordinates TEXT,  -- Future: PostGIS POINT for geocoding
  
  -- Victims (indexed for statistics)
  total_victims INTEGER DEFAULT 0,
  injured_victims INTEGER DEFAULT 0,  -- total_victims - fatal_victims
  fatal_victims INTEGER DEFAULT 0,
  
  -- Flexible data in JSONB
  crash_data JSONB NOT NULL,
  environmental_data JSONB,
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_traffic_calls_datetime ON traffic_calls(datetime);
CREATE INDEX idx_traffic_calls_nature ON traffic_calls(nature);
CREATE INDEX idx_traffic_calls_neighborhood ON traffic_calls(neighborhood);
CREATE INDEX idx_traffic_calls_victims ON traffic_calls(total_victims, fatal_victims);

-- JSONB indexes for nested queries
CREATE INDEX idx_traffic_calls_crash_type ON traffic_calls((crash_data->>'type'));
```

### JSONB Field Structures

#### `crash_data` - Incident Details
```json
{
  "type": "COLISÃO",  // tipo
  "description": "...",  // descricao
  "vehicles": {
    "cars": 1,  // auto
    "motorcycles": 0,  // moto
    "bicycles": 0,  // ciclom
    "cyclists": 0,  // ciclista
    "pedestrians": 1,  // pedestre
    "buses": 0,  // onibus
    "trucks": 0,  // caminhao
    "police_vehicles": 0,  // viatura
    "others": 0  // outros
  }
}
```

#### `environmental_data` - Road & Weather Conditions
```json
{
  "weather": "...",  // tempo_clima
  "traffic_light_number": "260",  // num_semaforo
  "traffic_light_status": "...",  // situacao_semaforo
  "signage": "...",  // sinalizacao
  "road_conditions": "...",  // condicao_via
  "road_conservation": "...",  // conservacao_via
  "road_direction": "...",  // sentido_via
  "sign_status": "...",  // situacao_placa
  "max_speed": "...",  // velocidade_max_via
  "traffic_direction": "...",  // mao_direcao
  "road_divisions": ["...", "...", "..."]  // divisao_via1, divisao_via2, divisao_via3
}
```

#### `metadata` - Administrative & Additional Location
```json
{
  "original_id": "...",  // _id
  "protocol": "...",  // Protocolo
  "status": "FINALIZADA",  // situacao
  "verified": true,  // acidente_verificado
  "control_point": "...",  // ponto_controle
  "location_details": {
    "street_number": "...",  // numero
    "address_detail": "...",  // detalhe_endereco_acidente
    "complement": "...",  // complemento
    "cross_street": "...",  // endereco_cruzamento
    "cross_street_number": "...",  // numero_cruzamento
    "cross_street_reference": "...",  // referencia_cruzamento
    "cross_street_neighborhood": "..."  // bairro_cruzamento
  }
}
```

## Example Mapping

**CSV Row:**
```csv
2016-01-01,07:26:00,COM VÍTIMA,FINALIZADA,CABANGA,AV SUL GOV. CID SAMPAIO,0,,,NO SEMAFORO Nº260,AV SUL,0,NO SEMAFORO Nº260,CABANGA,COLISÃO,COL.C/V SET.CD,1,,1,,,,,,,1,,,,,,,,,,,,,,,,,,
```

**Database Record:**
```json
{
  "datetime": "2016-01-01T07:26:00",
  "nature": "COM VÍTIMA",
  "street_name": "AV SUL GOV. CID SAMPAIO",
  "neighborhood": "CABANGA",
  "total_victims": 1,
  "injured_victims": 1,
  "fatal_victims": 0,
  "crash_data": {
    "type": "COLISÃO",
    "description": "COL.C/V SET.CD",
    "vehicles": {
      "cars": 1,
      "motorcycles": 0,
      "bicycles": 1,
      "cyclists": 0,
      "pedestrians": 0,
      "buses": 0,
      "trucks": 0,
      "police_vehicles": 0,
      "others": 0
    }
  },
  "environmental_data": {
    "traffic_light_number": "260"
  },
  "metadata": {
    "status": "FINALIZADA",
    "location_details": {
      "address_detail": "NO SEMAFORO Nº260",
      "cross_street": "AV SUL",
      "cross_street_reference": "NO SEMAFORO Nº260",
      "cross_street_neighborhood": "CABANGA"
    }
  }
}
```

## Benefits of This Schema

1. **Performance**: Indexed columns for common queries (date, neighborhood, victims)
2. **Flexibility**: JSONB allows storing variable data without schema changes
3. **Queryability**: PostgreSQL JSONB operators enable efficient nested queries
4. **Type Safety**: Drizzle ORM with Zod validation ensures data integrity
5. **Future-proof**: Easy to add geocoding (PostGIS) or new fields

## Common Query Patterns

### Filter by Date Range
```typescript
const calls = await db.select()
  .from(trafficCalls)
  .where(
    and(
      gte(trafficCalls.datetime, new Date('2023-01-01')),
      lte(trafficCalls.datetime, new Date('2023-12-31'))
    )
  );
```

### Filter by Neighborhood
```typescript
const calls = await db.select()
  .from(trafficCalls)
  .where(ilike(trafficCalls.neighborhood, '%BOA VIAGEM%'));
```

### Filter by Crash Type (JSONB)
```sql
SELECT * FROM traffic_calls
WHERE crash_data->>'type' = 'ATROPELAMENTO';
```

### Statistics by Type
```sql
SELECT 
  crash_data->>'type' as crash_type,
  COUNT(*) as total,
  SUM(total_victims) as total_victims,
  SUM(fatal_victims) as fatal_victims
FROM traffic_calls
GROUP BY crash_data->>'type'
ORDER BY total DESC;
```

## Next Steps

1. **Update Schema**: Modify `packages/database/src/schemas/traffic-calls/schema.ts` with the proposed structure
2. **Create Migration**: Generate migration with `pnpm --filter @atlas/database db:generate`
3. **Import Data**: Create a seed script to import CSV data
4. **Build API**: Create routes for querying traffic calls
5. **Add Geocoding**: Future enhancement to convert addresses to coordinates

