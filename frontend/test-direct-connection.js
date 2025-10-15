require('dotenv').config();
const { Client } = require('pg');

// Test pooled connection
const pooledClient = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test direct connection
const directClient = new Client({
  connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED,
  ssl: { rejectUnauthorized: false }
});

async function testPooled() {
  console.log('\n🔵 Testing POOLED connection...');
  console.log('URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
  
  try {
    await pooledClient.connect();
    const result = await pooledClient.query('SELECT NOW()');
    console.log('✅ Pooled connection successful!');
    console.log('Server time:', result.rows[0].now);
    await pooledClient.end();
    return true;
  } catch (error) {
    console.error('❌ Pooled connection failed:', error.message);
    return false;
  }
}

async function testDirect() {
  console.log('\n🟢 Testing DIRECT connection...');
  console.log('URL:', (process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED)?.replace(/:[^:@]+@/, ':****@'));
  
  try {
    await directClient.connect();
    const result = await directClient.query('SELECT NOW()');
    console.log('✅ Direct connection successful!');
    console.log('Server time:', result.rows[0].now);
    await directClient.end();
    return true;
  } catch (error) {
    console.error('❌ Direct connection failed:', error.message);
    return false;
  }
}

async function main() {
  const pooledSuccess = await testPooled();
  const directSuccess = await testDirect();
  
  console.log('\n📊 Summary:');
  console.log('Pooled:', pooledSuccess ? '✅' : '❌');
  console.log('Direct:', directSuccess ? '✅' : '❌');
  
  if (!pooledSuccess && !directSuccess) {
    console.log('\n⚠️  Both connections failed. Possible issues:');
    console.log('1. Database is suspended on Neon (check dashboard)');
    console.log('2. Credentials are incorrect or expired');
    console.log('3. Database project was deleted');
    console.log('\n👉 Visit: https://console.neon.tech');
  }
}

main();
