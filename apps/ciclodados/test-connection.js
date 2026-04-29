// Simple connection test script
import fetch from "node-fetch";

const BASE_URL = "http://localhost:3050";

async function testConnection() {
	console.log("🔍 Testing Ciclodados API Connection...\n");

	try {
		// Test health endpoint
		console.log("1. Testing health endpoint...");
		const healthResponse = await fetch(`${BASE_URL}/health`);
		const healthData = await healthResponse.json();

		console.log(`   Status: ${healthResponse.status}`);
		console.log(`   Response:`, healthData);

		if (healthData.database && healthData.pcr_streets) {
			console.log("   ✅ Database connection OK");
		} else {
			console.log("   ❌ Database connection issues");
		}

		// Test street search (if database is working)
		if (healthData.database && healthData.pcr_streets) {
			console.log("\n2. Testing street search...");
			const searchResponse = await fetch(
				`${BASE_URL}/v1/streets/search?q=rua&limit=3`,
			);
			const searchData = await searchResponse.json();

			console.log(`   Status: ${searchResponse.status}`);
			console.log(`   Found ${searchData.matches?.length || 0} streets`);

			if (searchData.matches?.length > 0) {
				console.log("   ✅ Street search working");
				console.log(`   Sample: ${searchData.matches[0].name}`);
			} else {
				console.log("   ⚠️  No streets found (may be empty table)");
			}
		}
	} catch (error) {
		console.log("❌ Connection failed:", error.message);
	}
}

testConnection();
