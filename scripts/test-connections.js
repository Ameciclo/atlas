#!/usr/bin/env node

const services = [
  { name: 'cyclist-profile', port: 3000, endpoints: [
    '/health', 
    '/v1/cyclist-profiles',
    '/v1/cyclist-profiles/1'
  ]},
  { name: 'cyclist-counts', port: 3002, endpoints: [
    '/health', 
    '/v1/events', 
    '/v1/events/1',
    '/v1/locations',
    '/v1/locations/1',
    '/v1/locations/1/events'
  ]},
  { name: 'traffic-deaths', port: 3003, endpoints: [
    '/health', 
    '/v1/deaths/cyclists', 
    '/v1/deaths/by-city',
    '/v1/deaths/by-transport-mode',
    '/v1/stats', 
    '/v1/summary',
    '/v1/deaths/time-series'
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
    '/v1/infrastructure/1',
    '/v1/infrastructure/summary',
    '/v1/infrastructure/cycleways',
    '/v1/infrastructure/city-coverage',
    '/v1/infrastructure/cities/1/summary',
    '/v1/ways'
  ]},
  { name: 'emergency-calls', port: 3010, endpoints: [
    '/health', 
    '/v1/calls',
    '/v1/calls/1',
    '/v1/calls/summary',
    '/v1/calls/cities',
    '/v1/calls/cities/RECIFE/stats',
    '/v1/calls/outcomes?city=RECIFE',
    '/v1/calls/profiles?city=RECIFE',
    '/v1/unsafe-streets/cities/RECIFE/summary',
    '/v1/unsafe-streets/streets/Av.%20Boa%20Viagem/summary?city=RECIFE',
    '/v1/analytics'
  ]},
  { name: 'traffic-violations', port: 3013, endpoints: [
    '/health', 
    '/v1/violations',
    '/v1/violations/1',
    '/v1/violations/summary',
    '/v1/violations/by-type',
    '/v1/violations/by-agent',
    '/v1/violations/temporal-analysis',
    '/v1/streets',
    '/v1/streets/1025/summary'
  ]},
  { name: 'traffic-calls', port: 3019, endpoints: [
    '/health', 
    '/v1/calls',
    '/v1/calls/1'
  ]}
];

async function testEndpoint(service, endpoint) {
  const url = `http://localhost:${service.port}${endpoint}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
    
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