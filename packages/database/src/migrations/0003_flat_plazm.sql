-- Custom SQL migration file, put your code below! --

-- Adicionar colunas de coordenadas geográficas para bicycle_racks
ALTER TABLE "bicycle_racks" ADD COLUMN "latitude" DECIMAL(10,8);
ALTER TABLE "bicycle_racks" ADD COLUMN "longitude" DECIMAL(11,8);

-- Criar índice para consultas geográficas
CREATE INDEX "idx_bicycle_racks_coordinates" ON "bicycle_racks" ("latitude", "longitude");