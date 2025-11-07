import { eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { db } from "../../db/index.js";
import { pcrStreets } from "@atlas/database/schemas/pcr-streets";

export async function getStreetsByName(c: Context) {
	const { name } = c.req.param();
	
	const streets = await db.select({
		clogra_codi: pcrStreets.clogra_codi,
		nlogra_conc: pcrStreets.nlogra_conc,
		nlgpav_ofic: pcrStreets.nlgpav_ofic,
		nlgpav_resu: pcrStreets.nlgpav_resu,
		indpav: pcrStreets.indpav,
		db2gse_sde: pcrStreets.db2gse_sde,
	})
	.from(pcrStreets)
	.where(
		sql`UPPER(${pcrStreets.nlogra_conc}) = UPPER(${name})`
	);

	return c.json(streets);
}

export async function searchStreets(c: Context) {
	const { query } = c.req.query();
	
	if (!query) {
		return c.json({ error: "Query parameter is required" }, 400);
	}

	const streets = await db.select({
		clogra_codi: pcrStreets.clogra_codi,
		nlogra_conc: pcrStreets.nlogra_conc,
		nlgpav_ofic: pcrStreets.nlgpav_ofic,
		nlgpav_resu: pcrStreets.nlgpav_resu,
		indpav: pcrStreets.indpav,
		db2gse_sde: pcrStreets.db2gse_sde,
	})
	.from(pcrStreets)
	.where(
		sql`UPPER(${pcrStreets.nlogra_conc}) LIKE UPPER(${'%' + query + '%'})`
	)
	.limit(50);

	return c.json(streets);
}

export async function getStreetByCode(c: Context) {
	const { code } = c.req.param();
	
	if (!code) {
		return c.json({ error: "Code parameter is required" }, 400);
	}

	const street = await db.select({
		clogra_codi: pcrStreets.clogra_codi,
		nlogra_conc: pcrStreets.nlogra_conc,
		nlgpav_ofic: pcrStreets.nlgpav_ofic,
		nlgpav_resu: pcrStreets.nlgpav_resu,
		indpav: pcrStreets.indpav,
		db2gse_sde: pcrStreets.db2gse_sde,
		geometry: sql`ST_AsGeoJSON(${pcrStreets.coordinates})`.as('geometry'),
	})
	.from(pcrStreets)
	.where(eq(pcrStreets.clogra_codi, parseInt(code)));

	if (street.length === 0) {
		return c.json({ error: "Street not found" }, 404);
	}

	return c.json(street);
}

export async function getUniqueStreetNames(c: Context) {
	const uniqueNames = await db.selectDistinct({
		nlogra_conc: pcrStreets.nlogra_conc,
		nlgpav_ofic: pcrStreets.nlgpav_ofic,
		nlgpav_resu: pcrStreets.nlgpav_resu,
	})
	.from(pcrStreets)
	.orderBy(pcrStreets.nlogra_conc);

	return c.json(uniqueNames);
}