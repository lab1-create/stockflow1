require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT u.id, u.name, u.role, u.sector, d.name as bancada 
      FROM app_users u 
      LEFT JOIN destinations d ON u.default_destination_id = d.id
      ORDER BY u.name;
    `);
    console.table(res.rows);
  } catch(e) {
    console.error(e);
  } finally {
    client.release();
    pool.end();
  }
}
main();
