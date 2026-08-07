require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT m.id, u.name, u.sector FROM stock_movements m LEFT JOIN app_users u ON m.user_id = u.id ORDER BY m.created_at DESC LIMIT 5');
    console.table(res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
