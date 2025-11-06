// cyclist-infra/updater.js
const express = require("express");
const { Pool } = require("pg");
const osmtogeojson = require("osmtogeojson");
const turf = require("@turf/turf");

const OSMController = require("../../commons/osm-controller");
const layers = require("../../commons/layers.json");
const rmrCities = require("../../commons/pe-cities.json");

require("dotenv").config();

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DATABASE,
  password: process.env.POSTGRES_PASSWORD,
  port: process.env.POSTGRES_PORT,
  // ssl: true,
});

const router = express.Router();

// Route to use the data from comparePDConRMR function
router.get("/", async (req, res) => {
  try {
    const comparedData = await comparePDConRMR();
    await deleteAllDataFromWaysTable();
    console.log("DADOS apagados com sucesso");
    await insertWaysData(comparedData);
    console.log("GET /cyclist-infra/update: UPDATE successfully");
    res.json(comparedData);
  } catch (error) {
    console.error("GET /cyclist-infra/relations: Error fetching data:", error);
    res.status(500).json({ error: "An error occurred while fetching data." });
  }
});

//OK Function to fetch relations data from the database
async function getOSMIdFromRelations() {
  try {
    const query = `
        SELECT id,
        name,
        pdc_ref,
        pdc_notes,
        pdc_typology,
        pdc_km,
        pdc_stretch,
        pdc_cities,
        osm_id,
        notes
        FROM cyclist_infra.relations
    `;
    const { rows } = await pool.query(query);
    return rows;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("An error occurred while fetching data.");
  }
}

async function getCities() {
  try {
    const query = `
        SELECT id,
        name,
        state
        FROM public.cities
    `;
    const { rows } = await pool.query(query);
    return rows;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("An error occurred while fetching data.");
  }
}

// Function to compare existing infrastructure on the area with project on relations
async function compareExistingInfrastrutureOnAreaWithProjectOnRelations(
  existing,
  projected
) {
  try {
    const lastupdated = new Date();
    const allCycleWays = [];
    const projectedAndExisting = projected;
    const firstExisting = existing[0];
    const existingNotProjected = firstExisting.members.filter(
      (m) => !projected.some((p) => p.members.some((pm) => pm.id === m.id))
    );
    projectedAndExisting.push({
      ...firstExisting,
      members: existingNotProjected,
    });
    const cities = await getCities();
    const cityPromises = projectedAndExisting.map((element) => {
      return Promise.all(
        element.members.map((member) => {
          const geojson = osmtogeojson({ elements: [member] });
          const middleMember = Math.floor(member.geometry.length / 2);
          return getCityByPoint(
            cities,
            rmrCities,
            member.geometry[middleMember].lat,
            member.geometry[middleMember].lon,
            element
          ).then((city_id) => {
            let dual_carriageway = false;
            if (member.tags.dual_carriageway)
              dual_carriageway =
                member.tags.dual_carriageway == "yes" ? true : false;
            const total_km = turf.length(geojson);
            const typology = getTypologyFromProperties(member.tags);
            const onPDC = element.pdc != undefined;
            if (member.type === "way") {
              const newElementFormat = {
                osm_id: member.id,
                name: member.tags.name || "",
                length: dual_carriageway ? total_km / 2 : total_km,
                highway: member.tags.highway || "",
                has_cycleway: typology != "none" ? true : false,
                cycleway_typology: typology || "",
                relation_id: onPDC ? element.pdc.id : 0,
                geojson: geojson,
                lastUpdated: lastupdated,
                city_id: city_id,
                dual_carriageway: dual_carriageway,
                pdc_typology: onPDC ? element.pdc.pdc_typology : "notOnPDC",
              };
              allCycleWays.push(newElementFormat);
            }
          });
        })
      );
    });
    await Promise.all(cityPromises);
    return allCycleWays;
  } catch (error) {
    console.error("Error fetching data from Overpass API:", error);
    throw error;
  }
}

// function that compares PDC with the existent cycle in RMR
async function comparePDConRMR() {
  // Call the getOSMIdFromRelations() function to get the osm_id array
  const pdcData = await getOSMIdFromRelations();
  const pdcOsmIds = pdcData.map((relation) => relation.osm_id);
  const notNullPdcOsmIds = pdcOsmIds.filter((osmId) => osmId !== null);

  // Call the OSMController.getWaysOSMJsonFromRelationsIds() method to fetch the OSM data
  const pdcWaysData = await OSMController.getRelationJsonFromIds(
    notNullPdcOsmIds
  );

  // Map pdcData to include the relevant data for each element in pdcWaysData
  const pdcDataMappedPromises = pdcWaysData.elements.map(async (element) => {
    const matchingPdcData = pdcData.find((data) =>
      data.osm_id ? data.osm_id === element.id : null
    );
    const waysIds = element.members
      .filter((member) => member.type === "way")
      .map((member) => member.ref);

    const ways = await OSMController.getOSMJsonWaysFromWaysIds(waysIds);

    return {
      ...element,
      members: ways.elements,
      pdc: matchingPdcData,
    };
  });

  // Resolve all promises using Promise.all
  const pdcDataMapped = await Promise.all(pdcDataMappedPromises);

  // Call the OSMController.getOSMAreaData() method to fetch the OSM data
  const rmrCycleWaysData = await OSMController.getCycleWaysOSMJsonFromArea({
    area: "Região Metropolitana do Recife",
  });

  const fakeRelationOfRemainData = [
    {
      type: "relation",
      id: null,
      members: rmrCycleWaysData.elements,
      tags: {
        name: "",
      },
      pdc: pdcData.filter((p) => p.id === 0)[0],
    },
  ];

  return compareExistingInfrastrutureOnAreaWithProjectOnRelations(
    fakeRelationOfRemainData,
    pdcDataMapped
  );
}

async function getCityByPoint(cities, citiesJson, lat, lon, element) {
  const point = turf.point([lon, lat]);

  let cityId = null;

  for (const polygon of citiesJson.features) {
    if (turf.booleanPointInPolygon(point, polygon)) {
      cityId = polygon.properties.id;
      break;
    }
  }

  if (cityId == null && lat == -8.1795871 && lon == -34.9167551) {
    cityId = 2607901;
  } else if (cityId == null) {
    cityId = 2607208;
  }

  //const city = cities.find((c) => c.id === cityId);
  //const city_id = city ? city.id : null;
  return cityId;
}
// Function to get typology map from layers
function getTypologyMap() {
  const typologyMap = {};
  layers.forEach((layer) => {
    if (layer.filters) {
      layer.filters.forEach((filter) => {
        let filterString;
        if (Array.isArray(filter[0])) {
          filterString = filter[0].join("=");
        } else {
          filterString = filter.join("=");
        }
        typologyMap[filterString] = {
          name: layer.name,
          composed: Array.isArray(filter[0]) ? filter[0].join("=") : false,
        };
      });
    }
  });
  return typologyMap;
}

// Function to get typology from GeoJSON properties
function getTypologyFromProperties(properties) {
  const typologyMap = getTypologyMap();
  const filters = Object.entries(properties).map(([key, value]) => {
    const filterString = `${key}=${value}`;
    if (typologyMap[filterString]) {
      const { composed } = typologyMap[filterString];
      if (composed) {
        // Check if any property matches the composed filter
        const matchesComposed = Object.entries(properties).some(
          ([propKey, propValue]) => composed === `${propKey}=${propValue}`
        );

        // If there is a match, return the typology name
        if (matchesComposed) {
          return typologyMap[filterString].name;
        }
      } else {
        return typologyMap[filterString].name;
      }
    }
  });
  // If no match was found, return "none"
  const filteredFilters = filters.filter(Boolean);
  return filteredFilters.length > 0 ? filteredFilters[0] : "none";
}

async function deleteAllDataFromWaysTable() {
  try {
    const query = `DELETE FROM cyclist_infra.ways`;
    await pool.query(query);
    console.log("Deleted all data from cyclist_infra.ways table");
  } catch (error) {
    console.error("Error deleting data from cyclist_infra.ways table:", error);
    throw error;
  }
}

// Function to insert Ways data
async function insertWaysData(waysData) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const wayData of waysData) {
      const {
        osm_id,
        name,
        length,
        highway,
        has_cycleway,
        cycleway_typology,
        relation_id,
        geojson,
        lastupdated,
        city_id,
        dual_carriageway,
        pdc_typology,
      } = { ...wayData };

      const query = `
          INSERT INTO cyclist_infra.ways (
            osm_id,
            name,
            length,
            highway,
            has_cycleway,
            cycleway_typology,
            relation_id,
            geojson,
            lastupdated,
            city_id,
            dual_carriageway,
            pdc_typology
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (osm_id) DO NOTHING
        `;
      try {
        await client.query(query, [
          osm_id,
          name,
          length,
          highway,
          has_cycleway,
          cycleway_typology,
          relation_id,
          geojson,
          lastupdated,
          city_id,
          dual_carriageway,
          pdc_typology,
        ]);
        console.debug(
          `Inserted or updated ${wayData.osm_id} - ${wayData.name}`
        );
      } catch (error) {
        console.error(
          `Error inserting or updating ${wayData.osm_id} - ${wayData.name}:`,
          error
        );
        throw error;
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = router;
