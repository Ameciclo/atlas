#!/usr/bin/env node

const net = require('net');

const ports = [3000, 3001, 3003, 3004, 3005, 3010, 3013, 3019];
const services = {
  3000: 'cyclist-profile',
  3001: 'cyclist-counts', 
  3003: 'traffic-deaths',
  3004: 'docs',
  3005: 'bicycle-racks',
  3010: 'emergency-calls',
  3013: 'traffic-violations',
  3019: 'traffic-calls'
};

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(1000);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      resolve(false);
    });
    
    socket.connect(port, 'localhost');
  });
}

async function main() {
  console.log('🔍 Checking which ports are open...\n');
  
  const results = await Promise.all(
    ports.map(async (port) => {
      const isOpen = await checkPort(port);
      const service = services[port];
      const status = isOpen ? '✅' : '❌';
      console.log(`${status} Port ${port} (${service}): ${isOpen ? 'OPEN' : 'CLOSED'}`);
      return { port, service, isOpen };
    })
  );
  
  const openPorts = results.filter(r => r.isOpen);
  console.log(`\n📊 ${openPorts.length}/${ports.length} services are running`);
  
  if (openPorts.length > 0) {
    console.log('\n🚀 Running services:');
    openPorts.forEach(({ port, service }) => {
      console.log(`  • ${service} on http://localhost:${port}`);
    });
  }
}

main().catch(console.error);