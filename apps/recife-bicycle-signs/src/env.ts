import { z } from "zod";

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
	PORT: z.coerce.number().default(3010),
	DATABASE_URL: z.string().optional(),
	DB_HOST: z.string().default("localhost"),
	DB_PORT: z.coerce.number().default(5432),
	DB_USER: z.string().default("postgres"),
	DB_PASSWORD: z.string().default("postgres"),
	DB_NAME: z.string().default("recife-bicycle-signs_db"),
	DB_SSL: z.string().default("false"),
});

export type Env = z.infer<typeof EnvSchema>;

const env = EnvSchema.parse(process.env);

export default env;
