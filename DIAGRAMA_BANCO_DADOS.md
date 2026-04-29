# Diagrama de Banco de Dados - Projeto Atlas

## Visão Geral

O projeto Atlas utiliza uma **arquitetura de banco único com schema público**, onde todos os serviços compartilham o mesmo banco PostgreSQL com extensão PostGIS para dados geoespaciais.

### Tecnologias
- **Banco de Dados**: PostgreSQL 15+ com PostGIS
- **ORM**: Drizzle ORM
- **Linguagem**: TypeScript
- **Migrações**: Drizzle Kit
- **Schema**: Público único (`public`)

## Estrutura Geral do Banco

```mermaid
erDiagram
    %% Infraestrutura Ciclística
    cities ||--o{ cyclist_infra_relation_cities : "pertence"
    cyclist_infra_relations ||--o{ cyclist_infra_relation_cities : "abrange"
    cyclist_infra_relations ||--o{ pdc_relation_ways : "contém"
    
    %% Contagem de Ciclistas
    counting_locations ||--o{ counting_events : "hospeda"
    counting_events ||--o{ counting_sessions : "divide-se"
    counting_sessions ||--o{ session_movements : "registra"
    
    %% Infraestrutura de Apoio
    bicycle_racks }o--|| bicycle_rack_cities : "localiza-se"
    
    %% Dados de Trânsito
    official_streets ||--o{ traffic_violations : "ocorre"
    
    %% Dados Independentes
    cyclist_profiles
    emergency_calls
    shared_bike_stations
    traffic_calls
    traffic_deaths
    ciclomapa_infra
```

## Módulos por Domínio

### 1. Infraestrutura Ciclística (`cycling-infra`)

```mermaid
erDiagram
    cities {
        integer id PK
        text name
        text state
        text full_state
        boolean rmr
        timestamp created_at
        timestamp updated_at
    }
    
    cyclist_infra_relations {
        serial id PK
        text osm_id
        text pdc_ref
        text pdc_typology
        text name
        text pdc_stretch
        text pdc_cities
        text pdc_notes
        text notes
        real pdc_km
        timestamp created_at
        timestamp updated_at
    }
    
    pdc_relation_ways {
        serial id PK
        text osm_id
        integer relation_id FK
        text name
        text geometry_type
        text coordinates
        jsonb osm_properties
        jsonb geojson
        timestamp created_at
        timestamp updated_at
    }
    
    cyclist_infra_relation_cities {
        serial id PK
        integer relation_id FK
        integer city_id FK
        timestamp created_at
    }
    
    ciclomapa_infra {
        serial id PK
        text osm_id
        text name
        text infra_type
        text coordinates
        jsonb geojson
        timestamp created_at
        timestamp updated_at
    }
    
    cities ||--o{ cyclist_infra_relation_cities : "city_id"
    cyclist_infra_relations ||--o{ cyclist_infra_relation_cities : "relation_id"
    cyclist_infra_relations ||--o{ pdc_relation_ways : "relation_id"
```

### 2. Contagem de Ciclistas (`cyclist-counts`)

```mermaid
erDiagram
    counting_locations {
        serial id PK
        varchar name
        varchar city
        varchar state
        decimal latitude
        decimal longitude
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
    
    counting_events {
        serial id PK
        integer location_id FK
        date counting_date
        time start_time
        time end_time
        integer total_cyclists
        integer max_hour_cyclists
        jsonb weather_conditions
        text notes
        timestamp created_at
        timestamp updated_at
    }
    
    counting_sessions {
        serial id PK
        integer event_id FK
        varchar session_label
        timestamp start_time
        timestamp end_time
        integer total_cyclists
        jsonb characteristics
        timestamp created_at
        timestamp updated_at
    }
    
    session_movements {
        serial id PK
        integer session_id FK
        direction from_direction
        direction to_direction
        integer count
        timestamp created_at
    }
    
    counting_locations ||--o{ counting_events : "location_id"
    counting_events ||--o{ counting_sessions : "event_id"
    counting_sessions ||--o{ session_movements : "session_id"
```

### 3. Estacionamentos de Bicicletas (`bicycle-racks`)

```mermaid
erDiagram
    bicycle_racks {
        serial id PK
        text osm_id UK
        text osm_type
        text coordinates
        text name
        text description
        text amenity
        text bicycle_parking
        text capacity
        text access
        text covered
        text fee
        text supervised
        text lit
        text operator
        text operator_type
        text building
        text level
        text surface
        text addr_city
        text addr_street
        text addr_housenumber
        text addr_suburb
        text addr_postcode
        text opening_hours
        text payment_none
        text ref
        text source
        text source_date
        text wikidata
        text wikipedia
        timestamp created_at
        timestamp updated_at
    }
    
    bicycle_rack_cities {
        serial id PK
        text osm_id UK
        text city
        text state
        timestamp created_at
        timestamp updated_at
    }
```

### 4. Bicicletas Compartilhadas (`shared-bike`)

```mermaid
erDiagram
    shared_bike_stations {
        serial id PK
        text osm_id UK
        text name
        text ref
        text coordinates
        integer capacity
        text network
        text operator
        text operator_type
        text bicycle_rental_type
        boolean fee
        boolean payment_credit_cards
        boolean payment_debit_cards
        text alt_name
        jsonb properties
        timestamp created_at
        timestamp updated_at
    }
```

### 5. Perfis de Ciclistas (`cyclist-profile`)

```mermaid
erDiagram
    cyclist_profiles {
        serial id PK
        jsonb data
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
```

### 6. Chamadas de Emergência (`emergency-calls`)

```mermaid
erDiagram
    emergency_calls {
        serial id PK
        integer original_id
        timestamp date
        text time_minute
        text municipality
        text neighborhood
        text address
        text call_origin
        text origin_type
        text subtype
        text gender
        integer age
        text finalization_reason
        text outcome_reason
        text type
        text category
        text finalization_reason_normalized
        text outcome_reason_normalized
        text finalization_category
        text outcome_category
        text pcr_address
        timestamp created_at
        timestamp updated_at
    }
```

### 7. Acidentes de Trânsito (`traffic-calls`)

```mermaid
erDiagram
    traffic_calls {
        serial id PK
        timestamp datetime
        varchar nature
        integer total_victims
        integer injured_victims
        integer fatal_victims
        varchar street_name
        varchar neighborhood
        text coordinates
        jsonb crash_data
        jsonb environmental_data
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }
```

### 8. Mortes no Trânsito (`traffic-deaths`)

```mermaid
erDiagram
    traffic_deaths {
        serial id PK
        integer contador
        varchar tipobito
        date dtobito
        varchar horaobito
        varchar natural
        integer codmunnatu
        date dtnasc
        integer idade
        varchar sexo
        varchar racacor
        varchar estciv
        varchar esc
        varchar esc2010
        varchar seriescfal
        varchar ocup
        integer codmunres
        varchar lococor
        varchar codestab
        text estabdescr
        integer codmunocor
        text linhaa
        text linhab
        text linhac
        text linhad
        text linhaii
        text causabas
        text causabas_o
        text cb_pre
        varchar circobito
        varchar acidtrab
        varchar fonte
        varchar origem
        varchar assistmed
        varchar exame
        varchar cirurgia
        varchar necropsia
        date dtinvestig
        date dtcadastro
        date dtrecebim
        varchar numerolote
        varchar tppos
        varchar atestante
        varchar stcodifica
        varchar codificado
        varchar versaosist
        varchar versaoscb
        integer data_year
        varchar import_batch
        timestamp created_at
        timestamp updated_at
    }
```

### 9. Infrações de Trânsito (`traffic-violations`)

```mermaid
erDiagram
    official_streets {
        serial id PK
        integer code UK
        text name_concatenated
        text official_name
        text short_name
        text pavement_code
        text pavement_description
        boolean transport_corridor
        boolean perimeter_road
        integer neighborhood_code
        text neighborhood_name
        timestamp created_at
        timestamp updated_at
    }
    
    traffic_violations {
        serial id PK
        timestamp violation_date
        integer agent_id
        integer violation_type_id
        integer location_id
        text violation_code
        text law_code
        text description
        text location_description
        text coordinates
        integer street_code FK
        jsonb complementary_data
        timestamp created_at
        timestamp updated_at
    }
    
    official_streets ||--o{ traffic_violations : "street_code"
```

## Enums e Tipos Especiais

### Direction Enum
```sql
CREATE TYPE "direction" AS ENUM('north', 'east', 'south', 'west');
```

## Índices Importantes

### Traffic Deaths
- `idx_dtobito` - Data do óbito
- `idx_codmunocor` - Código município ocorrência  
- `idx_codmunres` - Código município residência
- `idx_causabas` - Causa básica
- `idx_data_year` - Ano dos dados
- `idx_year_munocor` - Ano + município ocorrência

## Campos Geoespaciais

Várias tabelas possuem campo `coordinates` como `text` que será migrado para PostGIS:

### Conversão Planejada para PostGIS
- `bicycle_racks.coordinates` → `geometry(Point, 4326)`
- `shared_bike_stations.coordinates` → `geometry(Point, 4326)`
- `traffic_calls.coordinates` → `geometry(Point, 4326)`
- `traffic_violations.coordinates` → `geometry(Point, 4326)`
- `ciclomapa_infra.coordinates` → `geometry(LineString, 4326)`
- `pdc_relation_ways.coordinates` → `geometry` (tipo baseado em `geometry_type`)

## Relacionamentos Principais

### 1:N (Um para Muitos)
- `counting_locations` → `counting_events`
- `counting_events` → `counting_sessions`
- `counting_sessions` → `session_movements`
- `cyclist_infra_relations` → `pdc_relation_ways`
- `official_streets` → `traffic_violations`

### N:N (Muitos para Muitos)
- `cities` ↔ `cyclist_infra_relations` (via `cyclist_infra_relation_cities`)

## Dados JSONB Estruturados

### Cyclist Counts - Characteristics
```json
{
  "cargo": 0,
  "helmet": 0,
  "juveniles": 0,
  "motor": 0,
  "other_active_modes": 0,
  "other_behaviors": 0,
  "others": 0,
  "rain": 0,
  "ride": 0,
  "service": 0,
  "shared_bike": 0,
  "sidewalk": 0,
  "women": 0,
  "wrong_way": 0
}
```

### Traffic Calls - Crash Data
```json
{
  "type": "COLISÃO",
  "description": "...",
  "address": "...",
  "vehicles": {
    "cars": 0,
    "motorcycles": 0,
    "bicycles": 0,
    "cyclists": 0,
    "pedestrians": 0,
    "buses": 0,
    "trucks": 0,
    "police_vehicles": 0,
    "others": 0
  }
}
```

## Estratégia de Dados

### Banco Único, Schema Público
- **Vantagem**: Consultas cross-service diretas
- **Vantagem**: Migrações centralizadas
- **Vantagem**: Relacionamentos entre domínios
- **Desvantagem**: Acoplamento entre serviços

### Dados Flexíveis com JSONB
- Campos `metadata`, `properties`, `characteristics`
- Validação via Zod schemas
- Evolução de schema sem migrações

### Dados Geoespaciais
- Preparado para PostGIS
- Coordenadas em WGS84 (SRID 4326)
- Suporte a Point, LineString, MultiLineString

## Volume de Dados Estimado

- **traffic_deaths**: ~50k registros (dados DATASUS anuais)
- **traffic_violations**: ~100k+ registros
- **cyclist_counts**: Crescimento orgânico
- **bicycle_racks**: ~1k registros (dados OSM)
- **emergency_calls**: ~10k+ registros anuais

## Considerações de Performance

1. **Índices**: Criados para queries frequentes (datas, localização)
2. **JSONB**: Permite índices GIN para consultas em campos flexíveis
3. **PostGIS**: Índices espaciais para consultas geográficas
4. **Particionamento**: Considerado para `traffic_deaths` por ano
5. **Materialized Views**: Para agregações complexas