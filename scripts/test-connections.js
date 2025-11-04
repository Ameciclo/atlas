#!/usr/bin/env node

const services = [
  { name: 'cyclist-profile', port: 3000, endpoints: ['/health', '/cyclist-profiles'] },
  { name: 'bicycle-racks', port: 3005, endpoints: ['/health', '/bicycle-racks'] },
  { name: 'cyclist-counts', port: 3001, endpoints: ['/health', '/events', '/locations', '/sessions'] },
  { name: 'emergency-calls', port: 3010, endpoints: ['/health', '/calls', '/analytics'] },
  { name: 'traffic-calls', port: 3019, endpoints: ['/health', '/calls'] },
  { name: 'traffic-deaths', port: 3003, endpoints: ['/health', '/cyclists', '/stats', '/summary'] },
  { name: 'traffic-violations', port: 3013, endpoints: ['/health', '/violations', '/streets'] },
  { name: 'docs', port: 3004, endpoints: ['/'] }
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