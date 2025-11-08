import { z } from "zod";

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace"])
		.default("info"),
	PORT: z.coerce.number().default(3020),
	DATABASE_URL: z.string().optional(),
	DB_HOST: z.string().default("localhost"),
	DB_PORT: z.coerce.number().default(5432),
	DB_USER: z.string().default("postgres"),
	DB_PASSWORD: z.string().default("postgres"),
	DB_NAME: z.string().default("atlas_dev"),
	DB_SSL: z.string().default("false"),
	MAX_WAYS_RESULTS: z.coerce.number().default(1000),
	GEOMETRY_SIMPLIFY_TOLERANCE: z.coerce.number().default(0.0001),
	GEOJSON_PRECISION: z.coerce.number().default(5),
});

export type Env = z.infer<typeof EnvSchema>;

const env = EnvSchema.parse(process.env);

export default env;
