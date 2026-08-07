require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      ALTER TABLE supplies 
      ADD COLUMN IF NOT EXISTS link text,
      ADD COLUMN IF NOT EXISTS unit_price numeric;
    `);
    console.log("Colunas adicionadas!");
  } finally {
    client.release();
    pool.end();
  }
}
main().catch(console.error);
