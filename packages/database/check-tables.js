import pg from "pg";

const client = new pg.Client(
	"postgresql://postgres:postgres@localhost:5432/atlas_dev",
);
await client.connect();
const res = await client.query(
	"SELECT tablename FROM pg_tables WHERE schemaname = 'public';",
);
console.log(
	"Tabelas:",
	res.rows.map((r) => r.tablename),
);
const types = await client.query(
	"SELECT typname FROM pg_type WHERE typname = 'direction';",
);
console.log("Tipo direction existe:", types.rows.length > 0);
await client.end();
