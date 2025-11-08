import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app.js";

// Get port from environment variable or use 3050 as default
const port = Number.parseInt(process.env.PORT || "3050", 10);

serve(
	{
		fetch: app.fetch,
		port,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
