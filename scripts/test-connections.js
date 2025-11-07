#!/usr/bin/env node

const services = [
  { name: 'cyclist-profile', port: 3000, endpoints: [
    '/health', 
    '/v1/cyclist-profiles',
    '/v1/cyclist-profiles/nearby?lat=-8.05&lon=-34.88',
    '/v1/cyclist-profiles/nearby-summary?lat=-8.05&lon=-34.88',
    '/v1/cyclist-profiles/summary',
    '/v1/cyclist-profiles/trends',
    '/v1/cyclist-profiles/gender-analysis',
    '/v1/cyclist-profiles/gender-analysis-by-location?lat=-8.05&lon=-34.88',
    '/v1/cyclist-profiles/analysis?gender=Feminino&year=2024',
    '/v1/cyclist-profiles/safety-analysis',
    '/v1/cyclist-profiles/survey-locations'
  ]},
  { name: 'cyclist-counts', port: 3002, endpoints: [
    '/health', 
    '/v1/events', 
    '/v1/events/1',
    '/v1/locations',
    '/v1/locations/1',
    '/v1/locations/1/events',
    '/v1/sessions/1'
  ]},
  { name: 'traffic-deaths', port: 3003, endpoints: [
    '/health', 
    '/v1/summary',
    '/v1/cities-by-year',
    '/v1/filtros',
    '/v1/matrix',
    '/v1/causas-secundarias',
    '/v2/summary',
    '/v2/deaths/cyclists', 
    '/v2/deaths/by-city',
    '/v2/deaths/by-transport-mode',
    '/v2/stats',
    '/v2/deaths/time-series'
  ]},
  { name: 'bicycle-racks', port: 3005, endpoints: [
    '/health', 
    '/v1/bicycle-racks', 
    '/v1/bicycle-racks/1',
    '/v1/bicycle-racks/nearby?lat=-8.0476&lng=-34.8770',
    '/v1/bicycle-racks/stats', 
    '/v1/bicycle-racks/geojson'
  ]},
  { name: 'shared-bike', port: 3015, endpoints: [
    '/health', 
    '/v1/stations',
    '/v1/stations/1'
  ]},
  { name: 'cycling-infra', port: 3020, endpoints: [
    '/health', 
    '/v1/infrastructure', 
    '/v1/infrastructure/1350',
    '/v1/infrastructure/cities/1/summary',
    '/v1/ways'
  ]},
  { name: 'emergency-calls', port: 3010, endpoints: [
    '/health', 
    '/v1/calls',
    '/v1/calls/1',
    '/v1/calls/cities/RECIFE/stats',
    '/v1/summary',
    '/v1/filters',
    '/v1/streets/summary',
    '/v1/streets/top',
    '/v1/streets/search?nome=Boa Viagem',
    '/v1/streets/history?nome=Avenida Boa Viagem',
    '/v1/cities',
    '/v2/unsafe-streets/cities/RECIFE/summary',
    '/v2/unsafe-streets/cities/RECIFE/concentration',
    '/v2/unsafe-streets/cities/RECIFE/geojson',
    '/v2/unsafe-streets/streets/Av. Boa Viagem/summary',
    '/v2/unsafe-streets/streets/Av. Boa Viagem/profiles',
    '/v2/unsafe-streets/streets/Av. Boa Viagem/geojson',
    '/v2/unsafe-streets/streets/Av. Boa Viagem/evolution',
    '/v2/unsafe-streets/streets/Av. Boa Viagem/records'
  ]},
  { name: 'traffic-violations', port: 3013, endpoints: [
    '/health', 
    '/v1/violations?month=12&year=2023',
    '/v1/violations/1',
    '/v1/violations/by-location?month=12&year=2023',
    '/v1/violations/geojson?month=12&year=2023',
    '/v1/streets',
    '/v1/streets/46540/summary'
  ]},
  { name: 'traffic-calls', port: 3019, endpoints: [
    '/health', 
    '/v1/calls',
    '/v1/calls/1'
  ]},
  { name: 'pcr-streets', port: 3016, endpoints: [
    '/health', 
    '/v1/streets/names',
    '/v1/streets/search?query=cedro',
    '/v1/streets/name/RUA CEDRO',
    '/v1/streets/code/15989'
  ]}
];

async function testEndpoint(service, endpoint) {
  const url = `http://localhost:${service.port}${endpoint}`;
  try {
    const controller = new AbortController();
    // Longer timeout for heavy endpoints
    const timeout = endpoint.includes('/violations') || endpoint.includes('/streets/') ? 10000 : 2000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const status = response.ok ? '✅' : '❌';
    console.log(`  ${status} ${endpoint} (${response.status})`);
    return response.ok;
  } catch (error) {
    console.log(`  ❌ ${endpoint} (Connection failed)`);
    return false;
  }
}

async function testService(service) {
  console.log(`\n🔍 Testing ${service.name} on port ${service.port}:`);
  
  let successCount = 0;
  for (const endpoint of service.endpoints) {
    const success = await testEndpoint(service, endpoint);
    if (success) successCount++;
  }
  
  const status = successCount === service.endpoints.length ? '✅' : 
                 successCount > 0 ? '⚠️' : '❌';
  console.log(`${status} ${service.name}: ${successCount}/${service.endpoints.length} endpoints working`);
  
  return successCount;
}

async function main() {
  console.log('🚀 Testing Atlas API connections...\n');
  
  let totalSuccess = 0;
  let totalEndpoints = 0;
  
  for (const service of services) {
    const success = await testService(service);
    totalSuccess += success;
    totalEndpoints += service.endpoints.length;
  }
  
  console.log(`\n📊 Summary: ${totalSuccess}/${totalEndpoints} endpoints working`);
  
  if (totalSuccess === totalEndpoints) {
    console.log('🎉 All services are running correctly!');
  } else if (totalSuccess > 0) {
    console.log('⚠️  Some services have issues');
  } else {
    console.log('❌ No services are responding');
  }
}

main().catch(console.error);