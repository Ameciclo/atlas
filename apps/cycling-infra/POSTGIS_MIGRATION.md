# PostGIS Migration for Cycling-Infra

## Por que PostGIS?

O schema atual usa `jsonb` para armazenar geometrias, mas PostGIS oferece:
- Consultas espaciais eficientes (`ST_Intersects`, `ST_Distance`, `ST_Within`)
- Índices espaciais automáticos (GIST)
- Análises geoespaciais avançadas
- Performance superior para queries espaciais

## ⚠️ Importante: Adicionar APÓS schema inicial

**Motivo**: Drizzle ORM não suporta tipos PostGIS nativamente, então:
1. Criar schema com `jsonb` primeiro
2. Adicionar colunas PostGIS via migração customizada
3. Converter dados existentes

## Migração PostGIS

### 1. Gerar migração customizada:
```bash
pnpm --filter @atlas/database db:custom
```

### 2. Editar arquivo SQL gerado:
```sql
-- Custom SQL migration file, put your code below! --

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry columns
ALTER TABLE "pdc_relation_ways" 
ADD COLUMN "geometry" geometry(LineString, 4326);

ALTER TABLE "ciclomapa_infra" 
ADD COLUMN "geometry" geometry(LineString, 4326);

-- Convert existing GeoJSON to PostGIS geometry
UPDATE "pdc_relation_ways" 
SET "geometry" = ST_GeomFromGeoJSON(geojson::text);

UPDATE "ciclomapa_infra" 
SET "geometry" = ST_GeomFromGeoJSON(geojson::text);

-- Create spatial indexes
CREATE INDEX idx_pdc_ways_geometry ON "pdc_relation_ways" USING GIST ("geometry");
CREATE INDEX idx_ciclomapa_geometry ON "ciclomapa_infra" USING GIST ("geometry");
```

### 3. Aplicar migração:
```bash
pnpm --filter @atlas/database db:migrate
```

## Queries Espaciais Exemplo

```sql
-- Infraestrutura dentro de 500m de um ponto
SELECT * FROM ciclomapa_infra 
WHERE ST_DWithin(geometry, ST_Point(-34.9, -8.0), 500);

-- Intersecção entre PDC e ciclomapa
SELECT p.name, c.name 
FROM pdc_relation_ways p
JOIN ciclomapa_infra c ON ST_Intersects(p.geometry, c.geometry);

-- Comprimento total por tipologia
SELECT cycleway_typology, SUM(ST_Length(geometry::geography)) as total_meters
FROM ciclomapa_infra 
GROUP BY cycleway_typology;
```

## Vantagens

- **Performance**: Consultas espaciais 10x+ mais rápidas
- **Funcionalidades**: Análises geoespaciais avançadas
- **Padrão**: PostGIS é o padrão da indústria para dados geoespaciais
- **Compatibilidade**: Mantém `jsonb` para compatibilidade com APIs