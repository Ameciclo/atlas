import { serve } from "@hono/node-server";
import app from "./app.js";

// Get port from environment variable or use 3002 as default
const port = Number.parseInt(process.env.PORT || "3002", 10);

serve(
	{
		fetch: app.fetch,
		port,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
