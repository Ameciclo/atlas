import { readFileSync } from 'node:fs'
import pkg from 'pg'
const { Client } = pkg

const DATABASE_URL =
  'postgresql://atlas:AVNS_NK_FoQ5fDFAz6tu7hzs@private-ameciclo-postgres-db-do-user-18311227-0.i.db.ondigitalocean.com:25060/atlas?sslmode=require'
const DATABASE_SSL_CA = './do-ca-certificate.crt'

console.log('🔍 Testing different SSL configurations...\n')

// Test 1: With CA certificate and rejectUnauthorized: false
async function testWithCA () {
  console.log('Test 1: With CA certificate and rejectUnauthorized: false')
  try {
    const ca = readFileSync(DATABASE_SSL_CA, 'utf8')
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        ca,
        rejectUnauthorized: false
      }
    })

    await client.connect()
    console.log('✅ Connected successfully!')

    const result = await client.query('SELECT version()')
    console.log('PostgreSQL version:', result.rows[0].version)

    await client.end()
    console.log('✅ Connection closed\n')
    return true
  } catch (error) {
    console.error('❌ Failed:', error.message)
    console.error('Error code:', error.code, '\n')
    return false
  }
}

// Test 2: Without CA certificate, only rejectUnauthorized: false
async function testWithoutCA () {
  console.log('Test 2: Without CA certificate, only rejectUnauthorized: false')
  try {
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })

    await client.connect()
    console.log('✅ Connected successfully!')

    const result = await client.query('SELECT version()')
    console.log('PostgreSQL version:', result.rows[0].version)

    await client.end()
    console.log('✅ Connection closed\n')
    return true
  } catch (error) {
    console.error('❌ Failed:', error.message)
    console.error('Error code:', error.code, '\n')
    return false
  }
}

// Test 3: With CA certificate and rejectUnauthorized: true
async function testWithCAStrict () {
  console.log('Test 3: With CA certificate and rejectUnauthorized: true')
  try {
    const ca = readFileSync(DATABASE_SSL_CA, 'utf8')
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        ca,
        rejectUnauthorized: true
      }
    })

    await client.connect()
    console.log('✅ Connected successfully!')

    const result = await client.query('SELECT version()')
    console.log('PostgreSQL version:', result.rows[0].version)

    await client.end()
    console.log('✅ Connection closed\n')
    return true
  } catch (error) {
    console.error('❌ Failed:', error.message)
    console.error('Error code:', error.code, '\n')
    return false
  }
}

// Test 4: Only with CA certificate (no rejectUnauthorized specified)
async function testOnlyCA () {
  console.log(
    'Test 4: Only with CA certificate (no rejectUnauthorized specified)'
  )
  try {
    const ca = readFileSync(DATABASE_SSL_CA, 'utf8')
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        ca
      }
    })

    await client.connect()
    console.log('✅ Connected successfully!')

    const result = await client.query('SELECT version()')
    console.log('PostgreSQL version:', result.rows[0].version)

    await client.end()
    console.log('✅ Connection closed\n')
    return true
  } catch (error) {
    console.error('❌ Failed:', error.message)
    console.error('Error code:', error.code, '\n')
    return false
  }
}

// Run all tests
;(async () => {
  const test1 = await testWithCA()
  const test2 = await testWithoutCA()
  const test3 = await testWithCAStrict()
  const test4 = await testOnlyCA()

  console.log('='.repeat(60))
  console.log('Summary:')
  console.log('Test 1 (CA + rejectUnauthorized: false):', test1 ? '✅' : '❌')
  console.log(
    'Test 2 (No CA + rejectUnauthorized: false):',
    test2 ? '✅' : '❌'
  )
  console.log('Test 3 (CA + rejectUnauthorized: true):', test3 ? '✅' : '❌')
  console.log('Test 4 (Only CA):', test4 ? '✅' : '❌')
  console.log('='.repeat(60))
})()
