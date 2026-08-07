require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixRLS() {
  const tables = ['app_users', 'supplies', 'stock_movements', 'stock_requests', 'destinations'];
  for (const table of tables) {
    console.log(`Disabling RLS for ${table}...`);
    try {
      await pool.query(`ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`);
      console.log(`Success: ${table}`);
    } catch (err) {
      console.error(`Error on ${table}:`, err.message);
    }
  }
  pool.end();
}

fixRLS();
