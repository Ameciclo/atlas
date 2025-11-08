import { ApiReferenceReact } from "@scalar/api-reference-react";
import { useEffect, useState } from "react";
import "@scalar/api-reference-react/style.css";
import { discoverOpenApiSpecs } from "./utils/openapi-discovery";

export default function App() {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);
	const [apiSpecs, setApiSpecs] = useState([]);

	useEffect(() => {
		// Discover available OpenAPI specs
		discoverOpenApiSpecs()
			.then((specs) => {
				if (specs.length === 0) {
					throw new Error(
						"No OpenAPI specs found. Make sure API services have generated their specs.",
					);
				}
				setApiSpecs(specs);
				setIsLoading(false);
			})
			.catch((err) => {
				setError(err.message);
				setIsLoading(false);
			});
	}, []);

	if (isLoading) {
		return <div style={{ padding: 24 }}>Loading API documentation...</div>;
	}

	if (error) {
		return (
			<div style={{ padding: 24 }}>
				<h1 style={{ marginBottom: 24, fontSize: 28, color: "#e53e3e" }}>
					Error Loading API Documentation
				</h1>
				<p>{error}</p>
				<p>Make sure you've generated the OpenAPI specs by running:</p>
				<pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 4 }}>
					pnpm turbo run pre-dev
				</pre>
				<p>Or simply restart the development server with:</p>
				<pre style={{ background: "#f5f5f5", padding: 16, borderRadius: 4 }}>
					pnpm dev
				</pre>
			</div>
		);
	}

	return (
		<ApiReferenceReact
			configuration={{
				theme: {
					colors: {
						primary: {
							main: "#3182ce",
						},
					},
				},
				layout: "modern",
				metadata: {
					title: "Atlas API Documentation",
				},
				sources: apiSpecs,
			}}
		/>
	);
}
