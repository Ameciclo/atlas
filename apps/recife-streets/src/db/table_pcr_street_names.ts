import {
  serial,
  text,
  varchar,
  integer,
  uniqueIndex,
  geometry,
} from "drizzle-orm/pg-core";

import { global } from "./schema_global";

export const pcr_street_names = global.table(
  "pcr_street_names",
  {
    id: serial("id").primaryKey(),
    codlogradouro: integer("codlogradouro").notNull().unique(),
    nome_logradouro_concatenado: text("nome_logradouro_concatenado").notNull(),
    nome_oficial_logradouro: text("nome_oficial_logradouro").notNull(),
    nome_logradouro_resumido: text("nome_logradouro_resumido").notNull(),
    slug: varchar("slug"),
    cod_indica_pavimentacao: varchar("cod_indica_pavimentacao"),
    desc_indica_pavimentacao: text("desc_indica_pavimentacao"),
    indica_corredor_transporte: varchar("indica_corredor_transporte"),
    indica_perimetral: varchar("indica_perimetral"),
    codbairro: integer("codbairro"),
    nomeBairro: text("nomeBairro"),
    geom: geometry("geom", {
      type: "multilinestring",
      srid: 4326,
    }),
  },
  (t) => ({
    unique_rua_bairro: uniqueIndex("pref_street_rua_bairro_unique").on(
      t.codlogradouro,
      t.codbairro
    ),
  })
);
/* 
    // Street names extracted from OSM
    export const osm_street_names = streets.table(
    "osm_street_names",
    {
        id: serial("id").primaryKey(),
        osm_name: text("osm_name").notNull(),
        osm_id: integer("osm_id"),
    },
    (t) => ({
        unique_osm_name: uniqueIndex("osm_name_unique").on(t.osm_name),
    })
    );

    // Many-to-many matches between prefeitura names and OSM names
    export const street_name_matches = streets.table("street_name_matches", {
    id: serial("id").primaryKey(),
    pref_id: integer("pref_names_id")
        .notNull()
        .references(() => pref_street_names.id),
    osm_id: integer("osm_names_id")
        .notNull()
        .references(() => osm_street_names.id),
    status: varchar("status"), // e.g. 'pending', 'confirmed', 'rejected'
    matched_at: timestamp("matched_at"),
    notes: text("notes"),
    });
    */
