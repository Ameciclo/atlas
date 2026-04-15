import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function checkDatabaseConnection(db: NodePgDatabase<any>): Promise<boolean> {
	try {
		await db.execute(sql`SELECT 1`);
		return true;
	} catch {
		return false;
	}
}

export async function checkPcrStreetsTable(db: NodePgDatabase<any>): Promise<boolean> {
	try {
		await db.execute(sql`SELECT COUNT(*) FROM pcr_streets LIMIT 1`);
		return true;
	} catch {
		return false;
	}
}
