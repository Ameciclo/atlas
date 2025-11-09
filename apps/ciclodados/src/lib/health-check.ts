import { db } from "./database.js";
import { sql } from "drizzle-orm";

export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		await db.execute(sql`SELECT 1`);
		return true;
	} catch {
		return false;
	}
}

export async function checkPcrStreetsTable(): Promise<boolean> {
	try {
		await db.execute(sql`SELECT COUNT(*) FROM pcr_streets LIMIT 1`);
		return true;
	} catch {
		return false;
	}
}
