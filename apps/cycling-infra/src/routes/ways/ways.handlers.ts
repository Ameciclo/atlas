import type { Context } from "hono";
import { createConnectedDatabase } from "@atlas/database";
import * as cyclingInfraSchema from "@atlas/database/schemas/cycling-infra";

export async function listWays(c: Context) {
  const db = await createConnectedDatabase();
  
  try {
    const ways = await db.select().from(cyclingInfraSchema.pdcRelationWays);
    return c.json(ways);
  } catch (error) {
    console.error("Error fetching ways:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}

export async function getWaysSummary(c: Context) {
  const db = await createConnectedDatabase();
  
  try {
    // Get all ways and infrastructure data
    const ways = await db.select().from(cyclingInfraSchema.pdcRelationWays);
    const infrastructure = await db.select().from(cyclingInfraSchema.ciclomapaInfra);
    
    // Create a map of existing infrastructure by osm_id
    const infraMap = new Map();
    infrastructure.forEach(infra => {
      infraMap.set(infra.osm_id, infra);
    });
    
    // Calculate summary for all ways
    const allSummary = calculateSummary(ways, infraMap);
    
    // Group by city (simplified - using first city from pdc_cities)
    const byCity: Record<string, any> = {};
    
    // For now, return simplified summary
    const summary = {
      all: allSummary,
      byCity: byCity
    };
    
    return c.json(summary);
  } catch (error) {
    console.error("Error generating summary:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}

export async function getAllWaysGeoJSON(c: Context) {
  const db = await createConnectedDatabase();
  
  try {
    const ways = await db.select().from(cyclingInfraSchema.pdcRelationWays);
    const infrastructure = await db.select().from(cyclingInfraSchema.ciclomapaInfra);
    
    // Create infrastructure map
    const infraMap = new Map();
    infrastructure.forEach(infra => {
      infraMap.set(infra.osm_id, infra);
    });
    
    // Convert to GeoJSON features
    const features = ways.map(way => {
      const hasInfra = infraMap.has(way.osm_id);
      const isNotOutPDC = way.relation_id !== null;
      
      let status = "NotPDC";
      if (isNotOutPDC) {
        status = hasInfra ? "Realizada" : "Projeto";
      }
      
      return {
        type: "Feature",
        geometry: way.geojson.geometry,
        properties: {
          id: way.id,
          name: way.name,
          osm_id: way.osm_id,
          STATUS: status,
          ...way.osm_properties
        }
      };
    });
    
    const allGeoJSON = {
      type: "FeatureCollection",
      features: features
    };
    
    // Group by city (simplified)
    const byCity: Record<string, any> = {};
    
    return c.json({
      all: allGeoJSON,
      byCity: byCity
    });
  } catch (error) {
    console.error("Error generating GeoJSON:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
}

function calculateSummary(ways: any[], infraMap: Map<string, any>) {
  let pdc_feito = 0;
  let out_pdc = 0;
  let pdc_total = 0;
  
  ways.forEach(way => {
    const hasInfra = infraMap.has(way.osm_id);
    const isNotOutPDC = way.relation_id !== null;
    const length = 1; // Simplified - would need actual length calculation
    
    if (hasInfra && isNotOutPDC) {
      pdc_feito += length;
    }
    if (hasInfra && !isNotOutPDC) {
      out_pdc += length;
    }
    if (isNotOutPDC) {
      pdc_total += length;
    }
  });
  
  const percent = pdc_total > 0 ? pdc_feito / pdc_total : 0;
  
  return {
    pdc_feito,
    out_pdc,
    pdc_total,
    percent
  };
}