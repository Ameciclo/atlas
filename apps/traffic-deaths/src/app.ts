import createApp from "./lib/create-app.js";
import healthRoutes from "./routes/health.js";
import exampleRoutes from "./routes/example/example.index.js";

const app = createApp().route("/", healthRoutes).route("/v1/", exampleRoutes);

// Add OpenAPI documentation
app.doc("/openapi.json", {
	openapi: "3.1.0",
	info: {
		title: "TrafficDeaths API",
		version: "1.0.0",
		description: "API service for traffic deaths data from DATASUS",
	},
});

// Simple documentation endpoint
app.get("/doc", (c) => {
	return c.html(`
		<!DOCTYPE html>
		<html>
		<head>
			<title>TrafficDeaths API Documentation</title>
		</head>
		<body>
			<h1>TrafficDeaths API</h1>
			<p>API service for traffic deaths data from DATASUS</p>
			<p><a href="/openapi.json">OpenAPI Specification</a></p>
		</body>
		</html>
	`);
});

export default app;
