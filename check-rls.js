require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query("SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'app_users'").then(res => {
  console.log(res.rows);
  pool.end();
}).catch(err => console.log(err));
