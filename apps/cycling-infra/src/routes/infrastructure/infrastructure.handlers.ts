import { eq } from "drizzle-orm";
import { createConnectedDatabase } from "@atlas/database";
import { ciclomapaInfra } from "@atlas/database/schemas/cycling-infra";

export const listInfrastructure = async (c: {
	req: { query: () => { type?: string; limit?: string } };
	json: (data: any) => any;
}) => {
	const db = await createConnectedDatabase();

	const { type, limit } = c.req.query();

	// Build query conditionally to avoid type issues
	const limitNum = limit ? parseInt(limit, 10) : 100;
	const validLimit = !Number.isNaN(limitNum) && limitNum > 0 ? limitNum : 100;

	let infrastructure: any[];

	if (type) {
		infrastructure = await db
			.select()
			.from(ciclomapaInfra)
			.where(eq(ciclomapaInfra.infra_type, type))
			.limit(validLimit);
	} else {
		infrastructure = await db.select().from(ciclomapaInfra).limit(validLimit);
	}

	return c.json(infrastructure);
};

export const getInfrastructure = async (c: {
	req: { param: (key: string) => string };
	json: (data: any, status?: number) => any;
}) => {
	const db = await createConnectedDatabase();

	const id = Number(c.req.param("id"));

	if (Number.isNaN(id)) {
		return c.json({ error: "Invalid ID" }, 400);
	}

	const infrastructure = await db
		.select()
		.from(ciclomapaInfra)
		.where(eq(ciclomapaInfra.id, id));

	if (infrastructure.length === 0) {
		return c.json({ error: "Infrastructure not found" }, 404);
	}

	return c.json(infrastructure[0]);
};
