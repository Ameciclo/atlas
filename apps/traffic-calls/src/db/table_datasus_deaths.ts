// db/schemas/traffic_crashes.ts
import {
  serial,
  integer,
  varchar,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { cities } from "../global/table_cities";
import { casualties } from "./casualties_schema";

export const datasus_deaths = casualties.table(
  "datasus_deaths",
  {
    id: serial("id").primaryKey(),
    contador: integer("contador"),
    tipobito: varchar("tipobito"),
    dtobito: date("dtobito").notNull(),
    horaobito: varchar("horaobito", { length: 5 }),
    natural: varchar("natural"),
    codmunnatu: integer("codmunnatu").references(() => cities.id),
    dtnasc: date("dtnasc"),
    idade: integer("idade"),
    sexo: varchar("sexo"),
    racacor: varchar("racacor"),
    estciv: varchar("estciv"),
    esc2010: varchar("esc2010"),
    seriescfal: varchar("seriescfal"),
    ocup: varchar("ocup"),
    codmunres: integer("codmunres").references(() => cities.id),
    lococor: varchar("lococor"),
    codmunocor: integer("codmunocor").references(() => cities.id),
    linhaa: varchar("linhaa"),
    linhab: varchar("linhab"),
    linhac: varchar("linhac"),
    linhad: varchar("linhad"),
    linhaii: varchar("linhaii"),
    circobito: varchar("circobito"),
    acidtrab: varchar("acidtrab"),
    fonte: varchar("fonte"),
    origem: varchar("origem"),
    esc: varchar("esc"),
    exame: varchar("exame"),
    cirurgia: varchar("cirurgia"),
    dtinvestig: date("dtinvestig"),
    causabas_o: varchar("causabas_o"),
    causabas: varchar("causabas"),
    created_at: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    unique_contador: uniqueIndex("datasus_deaths_contador_unique").on(
      t.contador,
      t.dtobito
    ),
  })
);
