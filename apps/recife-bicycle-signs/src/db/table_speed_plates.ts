import {
  serial,
  integer,
  varchar,
  geometry,
  index, // se não estiver disponível na sua versão, basta remover
} from "drizzle-orm/pg-core";
import { global } from "./schema_global";

/**
 * Pontos de sinalização de velocidade (placas ou trechos sinalizados)
 * ------------------------------------------------------------------
 * • mapillary_id (ou outro id externo) é mantido como UNIQUE para
 *   permitir upsert na hora do seed.
 * • geom: POINT EPSG 4326.
 */
export const speed_plates = global.table("speed_plates", {
  id: serial("id").primaryKey(),

  /** Velocidade máxima regulamentada em km/h.                    */
  speed: integer("speed").notNull(),

  /** Geometria do ponto (centro da placa).                       */
  geom: geometry("geom", { type: "Point", srid: 4326 }).notNull(),
});
