import { config } from "dotenv";
import { serve } from "@hono/node-server";
import app from "./app.js";

// Load environment variables from .env file
config();

// Get port from environment variable or use 3000 as default
const port = Number.parseInt(process.env.PORT || "3000", 10);

serve(
	{
		fetch: app.fetch,
		port,
	},
	(info) => {
		console.log(`Server is running on http://localhost:${info.port}`);
	},
);
