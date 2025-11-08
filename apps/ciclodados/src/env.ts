import { z } from "zod";

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
	PORT: z.coerce.number().default(3050),
	DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
	DEFAULT_BUFFER_METERS: z.coerce.number().default(50),
	MAX_SEARCH_RESULTS: z.coerce.number().default(100),
});

export type Env = z.infer<typeof EnvSchema>;

const env = EnvSchema.parse(process.env);

export default env;
