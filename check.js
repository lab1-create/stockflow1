require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT id, name, length(name) as len, active FROM app_users').then(res => {
  console.log(res.rows);
  pool.end();
}).catch(err => console.log(err));
