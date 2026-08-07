require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name IN ('app_users', 'supplies', 'stock_movements', 'stock_requests');
    `);
    console.table(res.rows);
  } finally {
    client.release();
    pool.end();
  }
}
main().catch(console.error);
