import { z } from "zod";

const EnvSchema = z.object({
	NODE_ENV: z.string().default("development"),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]),
});

export type env = z.infer<typeof EnvSchema>;

const env = EnvSchema.parse(process.env);

export default env;
