# Guia de Migração: Banco Antigo (Garfo) → Novo (Atlas)

## Resumo das Mudanças Arquiteturais

| Aspecto | Banco Antigo (Garfo) | Banco Novo (Atlas) |
|---------|----------------------|-------------------|
| **Organização** | 4 schemas separados | Schema público único |
| **Nomenclatura** | Nomes específicos do domínio | Nomes padronizados |
| **Geometrias** | PostGIS nativo | Coordenadas text → PostGIS |
| **Flexibilidade** | Campos fixos | JSONB para dados variáveis |

## Mapeamento de Tabelas e Campos

### 1. Schema `global` → Tabelas Base

#### `cities` → `cities`
```sql
-- MAPEAMENTO DIRETO (sem alterações)
old.cities.id → new.cities.id
old.cities.name → new.cities.name  
old.cities.state → new.cities.state
old.cities.full_state → new.cities.full_state
old.cities.rmr → new.cities.rmr

-- NOVOS CAMPOS
new.cities.created_at (timestamp atual)
new.cities.updated_at (timestamp atual)
```

#### `pcr_street_names` → `official_streets`
```sql
-- MAPEAMENTO COM RENOMEAÇÃO
old.pcr_street_names.id → new.official_streets.id
old.pcr_street_names.codlogradouro → new.official_streets.code
old.pcr_street_names.nome_logradouro_concatenado → new.official_streets.name_concatenated
old.pcr_street_names.nome_oficial_logradouro → new.official_streets.official_name
old.pcr_street_names.nome_logradouro_resumido → new.official_streets.short_name
old.pcr_street_names.cod_indica_pavimentacao → new.official_streets.pavement_code
old.pcr_street_names.desc_indica_pavimentacao → new.official_streets.pavement_description
old.pcr_street_names.indica_corredor_transporte → new.official_streets.transport_corridor (boolean)
old.pcr_street_names.indica_perimetral → new.official_streets.perimeter_road (boolean)
old.pcr_street_names.codbairro → new.official_streets.neighborhood_code
old.pcr_street_names.nomeBairro → new.official_streets.neighborhood_name

-- CAMPOS REMOVIDOS
old.pcr_street_names.slug (não migrado)
old.pcr_street_names.geom (não migrado - sem equivalente direto)

-- NOVOS CAMPOS
new.official_streets.created_at (timestamp atual)
new.official_streets.updated_at (timestamp atual)
```

### 2. Schema `casualties` → Múltiplas Tabelas

#### `samu_calls` → `emergency_calls`
```sql
-- MAPEAMENTO COM REESTRUTURAÇÃO
old.samu_calls.original_id → new.emergency_calls.original_id
old.samu_calls.data + old.samu_calls.hora_minuto → new.emergency_calls.date (timestamp)
old.samu_calls.hora_minuto → new.emergency_calls.time_minute
old.samu_calls.municipio → new.emergency_calls.municipality
old.samu_calls.bairro → new.emergency_calls.neighborhood
old.samu_calls.endereco → new.emergency_calls.address
old.samu_calls.endereco_pcr → new.emergency_calls.pcr_address
old.samu_calls.origem_chamado → new.emergency_calls.call_origin
old.samu_calls.orig_tipo → new.emergency_calls.origin_type
old.samu_calls.subtipo → new.emergency_calls.subtype
old.samu_calls.tipo → new.emergency_calls.type
old.samu_calls.categoria → new.emergency_calls.category
old.samu_calls.sexo → new.emergency_calls.gender
old.samu_calls.idade → new.emergency_calls.age
old.samu_calls.motivo_finalizacao → new.emergency_calls.finalization_reason
old.samu_calls.motivo_desfecho → new.emergency_calls.outcome_reason
old.samu_calls.motivo_fin_norm → new.emergency_calls.finalization_reason_normalized
old.samu_calls.motivo_desf_norm → new.emergency_calls.outcome_reason_normalized
old.samu_calls.motivo_fin_cat → new.emergency_calls.finalization_category
old.samu_calls.motivo_desf_cat → new.emergency_calls.outcome_category

-- CAMPOS REMOVIDOS
old.samu_calls.street_id (relacionamento removido)
old.samu_calls.city_id (relacionamento removido)
old.samu_calls.geom (não migrado diretamente)
old.samu_calls.row_hash (não necessário)
old.samu_calls.created_at (recriado)

-- NOVOS CAMPOS
new.emergency_calls.created_at (timestamp atual)
new.emergency_calls.updated_at (timestamp atual)
```

#### `cttu_crashes` → `traffic_calls`
```sql
-- MAPEAMENTO COM REESTRUTURAÇÃO SIGNIFICATIVA
old.cttu_crashes.data + old.cttu_crashes.hora → new.traffic_calls.datetime
old.cttu_crashes.natureza → new.traffic_calls.nature
old.cttu_crashes.vitimas → new.traffic_calls.total_victims
old.cttu_crashes.vitimas_fat → new.traffic_calls.fatal_victims
old.cttu_crashes.endereco → new.traffic_calls.street_name
old.cttu_crashes.bairro → new.traffic_calls.neighborhood

-- DADOS VEICULARES → JSONB crash_data.vehicles
old.cttu_crashes.auto → new.traffic_calls.crash_data.vehicles.cars
old.cttu_crashes.moto → new.traffic_calls.crash_data.vehicles.motorcycles
old.cttu_crashes.ciclom → new.traffic_calls.crash_data.vehicles.bicycles
old.cttu_crashes.ciclista → new.traffic_calls.crash_data.vehicles.cyclists
old.cttu_crashes.pedestre → new.traffic_calls.crash_data.vehicles.pedestrians
old.cttu_crashes.onibus → new.traffic_calls.crash_data.vehicles.buses
old.cttu_crashes.caminhao → new.traffic_calls.crash_data.vehicles.trucks
old.cttu_crashes.viatura → new.traffic_calls.crash_data.vehicles.police_vehicles
old.cttu_crashes.outros → new.traffic_calls.crash_data.vehicles.others

-- OUTROS DADOS → JSONB crash_data
old.cttu_crashes.tipo → new.traffic_calls.crash_data.type
old.cttu_crashes.descricao → new.traffic_calls.crash_data.description
old.cttu_crashes.endereco_cruzamento → new.traffic_calls.crash_data.intersection_address

-- CÁLCULO DERIVADO
new.traffic_calls.injured_victims = old.cttu_crashes.vitimas - old.cttu_crashes.vitimas_fat

-- CONVERSÃO GEOMÉTRICA
old.cttu_crashes.geom → new.traffic_calls.coordinates (text, depois PostGIS)

-- CAMPOS REMOVIDOS
old.cttu_crashes.street_id (relacionamento removido)
old.cttu_crashes.situacao (não migrado)
old.cttu_crashes.numero (não migrado)
old.cttu_crashes.row_hash (não necessário)

-- NOVOS CAMPOS
new.traffic_calls.environmental_data (jsonb vazio)
new.traffic_calls.metadata (jsonb vazio)
new.traffic_calls.created_at (timestamp atual)
new.traffic_calls.updated_at (timestamp atual)
```

#### `datasus_deaths` → `traffic_deaths`
```sql
-- MAPEAMENTO DIRETO COM EXPANSÃO
old.datasus_deaths.contador → new.traffic_deaths.contador
old.datasus_deaths.tipobito → new.traffic_deaths.tipobito
old.datasus_deaths.dtobito → new.traffic_deaths.dtobito
old.datasus_deaths.horaobito → new.traffic_deaths.horaobito
old.datasus_deaths.natural → new.traffic_deaths.natural
old.datasus_deaths.codmunnatu → new.traffic_deaths.codmunnatu
old.datasus_deaths.dtnasc → new.traffic_deaths.dtnasc
old.datasus_deaths.idade → new.traffic_deaths.idade
old.datasus_deaths.sexo → new.traffic_deaths.sexo
old.datasus_deaths.racacor → new.traffic_deaths.racacor
old.datasus_deaths.estciv → new.traffic_deaths.estciv
old.datasus_deaths.esc2010 → new.traffic_deaths.esc2010
old.datasus_deaths.seriescfal → new.traffic_deaths.seriescfal
old.datasus_deaths.ocup → new.traffic_deaths.ocup
old.datasus_deaths.codmunres → new.traffic_deaths.codmunres
old.datasus_deaths.lococor → new.traffic_deaths.lococor
old.datasus_deaths.codmunocor → new.traffic_deaths.codmunocor
old.datasus_deaths.linhaa → new.traffic_deaths.linhaa
old.datasus_deaths.linhab → new.traffic_deaths.linhab
old.datasus_deaths.linhac → new.traffic_deaths.linhac
old.datasus_deaths.linhad → new.traffic_deaths.linhad
old.datasus_deaths.linhaii → new.traffic_deaths.linhaii
old.datasus_deaths.circobito → new.traffic_deaths.circobito
old.datasus_deaths.acidtrab → new.traffic_deaths.acidtrab
old.datasus_deaths.fonte → new.traffic_deaths.fonte
old.datasus_deaths.origem → new.traffic_deaths.origem
old.datasus_deaths.esc → new.traffic_deaths.esc
old.datasus_deaths.exame → new.traffic_deaths.exame
old.datasus_deaths.cirurgia → new.traffic_deaths.cirurgia
old.datasus_deaths.dtinvestig → new.traffic_deaths.dtinvestig
old.datasus_deaths.causabas_o → new.traffic_deaths.causabas_o
old.datasus_deaths.causabas → new.traffic_deaths.causabas

-- NOVOS CAMPOS DATASUS (não existiam no antigo)
new.traffic_deaths.codestab (null)
new.traffic_deaths.estabdescr (null)
new.traffic_deaths.cb_pre (null)
new.traffic_deaths.assistmed (null)
new.traffic_deaths.necropsia (null)
new.traffic_deaths.dtcadastro (null)
new.traffic_deaths.dtrecebim (null)
new.traffic_deaths.numerolote (null)
new.traffic_deaths.tppos (null)
new.traffic_deaths.atestante (null)
new.traffic_deaths.stcodifica (null)
new.traffic_deaths.codificado (null)
new.traffic_deaths.versaosist (null)
new.traffic_deaths.versaoscb (null)

-- CAMPOS CALCULADOS
new.traffic_deaths.data_year = EXTRACT(year FROM old.datasus_deaths.dtobito)
new.traffic_deaths.import_batch = 'migration_' + CURRENT_DATE

-- NOVOS CAMPOS
new.traffic_deaths.created_at (timestamp atual)
new.traffic_deaths.updated_at (timestamp atual)
```

### 3. Schema `cyclist_count` → `cyclist-counts`

#### `cyclist_count_edition` → `counting_locations` + `counting_events`
```sql
-- DIVISÃO EM DUAS TABELAS

-- Para counting_locations:
old.cyclist_count_edition.id → new.counting_locations.id
old.cyclist_count_edition.name → new.counting_locations.name
-- Extrair cidade de cityId → new.counting_locations.city
-- Extrair estado de cityId → new.counting_locations.state
old.cyclist_count_edition.geom → new.counting_locations.latitude/longitude
new.counting_locations.metadata = {} (jsonb vazio)

-- Para counting_events:
old.cyclist_count_edition.id → new.counting_events.location_id (FK)
old.cyclist_count_edition.date → new.counting_events.counting_date
-- Calcular totais das sessões → new.counting_events.total_cyclists
new.counting_events.start_time = '08:00:00' (padrão)
new.counting_events.end_time = '18:00:00' (padrão)
new.counting_events.weather_conditions = {} (jsonb vazio)
new.counting_events.notes = null
```

#### `cyclist_count_session` → `counting_sessions`
```sql
old.cyclist_count_session.id → new.counting_sessions.id
old.cyclist_count_session.editionId → new.counting_sessions.event_id (FK)
old.cyclist_count_session.startTime → new.counting_sessions.start_time
old.cyclist_count_session.endTime → new.counting_sessions.end_time

-- AGREGAÇÃO DE CARACTERÍSTICAS
-- Combinar cyclist_count_characteristicsCount → new.counting_sessions.characteristics (jsonb)
new.counting_sessions.session_label = 'Session ' + old.cyclist_count_session.id
-- Calcular total de direction_count → new.counting_sessions.total_cyclists
```

#### `direction_count` → `session_movements`
```sql
old.direction_count.id → new.session_movements.id
old.direction_count.sessionId → new.session_movements.session_id (FK)
old.direction_count.count → new.session_movements.count

-- CONVERSÃO DE DIREÇÕES
-- Mapear directions.origin/destin → new.session_movements.from_direction/to_direction
-- Usar enum: 'north', 'east', 'south', 'west'
```

### 4. Schema `cyclist_infra` → `cycling-infra`

#### `cyclist_infra_relations` → `cyclist_infra_relations`
```sql
-- MAPEAMENTO COM RENOMEAÇÃO
old.cyclist_infra_relations.id → new.cyclist_infra_relations.id
old.cyclist_infra_relations.osmId → new.cyclist_infra_relations.osm_id (text)
old.cyclist_infra_relations.pdcRef → new.cyclist_infra_relations.pdc_ref
old.cyclist_infra_relations.pdcTypology → new.cyclist_infra_relations.pdc_typology
old.cyclist_infra_relations.name → new.cyclist_infra_relations.name
old.cyclist_infra_relations.pdcStretch → new.cyclist_infra_relations.pdc_stretch
old.cyclist_infra_relations.pdcCities → new.cyclist_infra_relations.pdc_cities
old.cyclist_infra_relations.pdcNotes → new.cyclist_infra_relations.pdc_notes
old.cyclist_infra_relations.notes → new.cyclist_infra_relations.notes
old.cyclist_infra_relations.pdcKm → new.cyclist_infra_relations.pdc_km

-- NOVOS CAMPOS
new.cyclist_infra_relations.created_at (timestamp atual)
new.cyclist_infra_relations.updated_at (timestamp atual)
```

#### `cyclist_infra_ways` → `pdc_relation_ways`
```sql
old.cyclist_infra_ways.osmId → new.pdc_relation_ways.osm_id (text)
old.cyclist_infra_ways.relationId → new.pdc_relation_ways.relation_id (FK)
old.cyclist_infra_ways.name → new.pdc_relation_ways.name
old.cyclist_infra_ways.geojson → new.pdc_relation_ways.geojson

-- CONVERSÃO DE GEOMETRIA
-- Determinar geometry_type baseado no geojson
-- Extrair coordinates do geojson → new.pdc_relation_ways.coordinates

-- DADOS OSM → JSONB
old.cyclist_infra_ways.highway → new.pdc_relation_ways.osm_properties.highway
old.cyclist_infra_ways.hasCycleway → new.pdc_relation_ways.osm_properties.hasCycleway
old.cyclist_infra_ways.cyclewayTypology → new.pdc_relation_ways.osm_properties.cyclewayTypology
old.cyclist_infra_ways.length → new.pdc_relation_ways.osm_properties.length
old.cyclist_infra_ways.dualCarriageway → new.pdc_relation_ways.osm_properties.dualCarriageway
old.cyclist_infra_ways.pdcTypology → new.pdc_relation_ways.osm_properties.pdcTypology
old.cyclist_infra_ways.cityId → new.pdc_relation_ways.osm_properties.cityId
old.cyclist_infra_ways.lastUpdated → new.pdc_relation_ways.osm_properties.lastUpdated

-- NOVOS CAMPOS
new.pdc_relation_ways.created_at (timestamp atual)
new.pdc_relation_ways.updated_at (timestamp atual)
```

#### `cyclist_infra_relationCities` → `cyclist_infra_relation_cities`
```sql
-- MAPEAMENTO DIRETO
old.cyclist_infra_relationCities.relationId → new.cyclist_infra_relation_cities.relation_id
old.cyclist_infra_relationCities.citiesId → new.cyclist_infra_relation_cities.city_id

-- NOVOS CAMPOS
new.cyclist_infra_relation_cities.created_at (timestamp atual)
```

## Tabelas Novas (Sem Equivalente no Banco Antigo)

### Dados que precisam ser coletados/importados:
- `bicycle_racks` (dados OSM)
- `bicycle_rack_cities` (dados OSM)
- `shared_bike_stations` (dados OSM)
- `cyclist_profiles` (dados novos)
- `traffic_violations` (dados novos)
- `ciclomapa_infra` (dados novos)

## Script de Migração Sugerido

```sql
-- 1. Migrar dados base
INSERT INTO cities SELECT id, name, state, full_state, rmr, NOW(), NOW() FROM old.cities;

-- 2. Migrar ruas
INSERT INTO official_streets 
SELECT id, codlogradouro, nome_logradouro_concatenado, nome_oficial_logradouro, 
       nome_logradouro_resumido, cod_indica_pavimentacao, desc_indica_pavimentacao,
       indica_corredor_transporte::boolean, indica_perimetral::boolean,
       codbairro, nomeBairro, NOW(), NOW()
FROM old.pcr_street_names;

-- 3. Migrar chamadas emergência
INSERT INTO emergency_calls 
SELECT nextval('emergency_calls_id_seq'), original_id, 
       (data::date + hora_minuto::time)::timestamp, hora_minuto,
       municipio, bairro, endereco, origem_chamado, orig_tipo, subtipo,
       sexo, idade, motivo_finalizacao, motivo_desfecho, tipo, categoria,
       motivo_fin_norm, motivo_desf_norm, motivo_fin_cat, motivo_desf_cat,
       endereco_pcr, NOW(), NOW()
FROM old.samu_calls;

-- 4. Migrar acidentes (com JSONB)
INSERT INTO traffic_calls
SELECT nextval('traffic_calls_id_seq'),
       (data::date + hora::time)::timestamp,
       natureza, vitimas, vitimas_fat, vitimas - vitimas_fat,
       endereco, bairro, ST_AsText(geom),
       jsonb_build_object(
         'type', tipo,
         'description', descricao,
         'intersection_address', endereco_cruzamento,
         'vehicles', jsonb_build_object(
           'cars', auto, 'motorcycles', moto, 'bicycles', ciclom,
           'cyclists', ciclista, 'pedestrians', pedestre, 'buses', onibus,
           'trucks', caminhao, 'police_vehicles', viatura, 'others', outros
         )
       ),
       '{}', '{}', NOW(), NOW()
FROM old.cttu_crashes;

-- 5. Migrar mortes no trânsito
INSERT INTO traffic_deaths
SELECT nextval('traffic_deaths_id_seq'), contador, tipobito, dtobito, horaobito,
       natural, codmunnatu, dtnasc, idade, sexo, racacor, estciv, esc, esc2010,
       seriescfal, ocup, codmunres, lococor, null, null, codmunocor,
       linhaa, linhab, linhac, linhad, linhaii, causabas, causabas_o, null,
       circobito, acidtrab, fonte, origem, null, exame, cirurgia, null,
       dtinvestig, null, null, null, null, null, null, null, null,
       EXTRACT(year FROM dtobito)::integer, 'migration_' || CURRENT_DATE,
       NOW(), NOW()
FROM old.datasus_deaths;
```

## Considerações Importantes

1. **Relacionamentos Perdidos**: Alguns FKs (street_id, city_id) foram removidos
2. **Geometrias**: Conversão de PostGIS → text → PostGIS planejada
3. **JSONB**: Dados estruturados agora em campos flexíveis
4. **Timestamps**: Todos os registros terão created_at/updated_at atuais
5. **Novos Índices**: Recriar índices espaciais e de performance após migração