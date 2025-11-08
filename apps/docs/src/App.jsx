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
		return (
			<div style={{ padding: 24 }}>
				<div>Loading API documentation...</div>
				<div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
					Atlas Docs v{import.meta.env.PACKAGE_VERSION || '0.0.1'}
				</div>
			</div>
		);
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
		<div>
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
			<div style={{
				position: 'fixed',
				bottom: '10px',
				right: '10px',
				fontSize: '11px',
				color: '#999',
				background: 'rgba(255,255,255,0.9)',
				padding: '4px 8px',
				borderRadius: '4px',
				border: '1px solid #eee'
			}}>
				Atlas Docs v{import.meta.env.PACKAGE_VERSION || '0.0.1'}
			</div>
		</div>
	);
}
