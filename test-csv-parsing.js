const fs = require('fs');
const path = require('path');

// Test CSV parsing
const csvPath = path.join(__dirname, 'apps/traffic-violations/src/db/enderecos_otimizado.csv');
const csvData = fs.readFileSync(csvPath, 'utf-8');

const lines = csvData.trim().split('\n');
const headers = lines[0].split(',');
const dataLines = lines.slice(1, 6); // Test first 5 lines

console.log('Headers:', headers);
console.log('\nTesting CSV parsing:');

for (const line of dataLines) {
    const values = line.split(',');
    
    if (values.length >= 5) {
        const codigo_logradouro = values[0] || "";
        const latitude = Number(values[1]) || 0;
        const longitude = Number(values[2]) || 0;
        const local_id = Number(values[values.length - 1]) || 0;
        const endereco_infracao = values.slice(3, -1).join(",");
        
        console.log({
            codigo_logradouro,
            latitude,
            longitude,
            endereco_infracao,
            local_id,
            original_line: line
        });
    }
}