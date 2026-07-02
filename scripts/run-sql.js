require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const files = process.argv.slice(2);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL nao configurada.");
  process.exit(1);
}

if (!files.length) {
  console.error("Informe pelo menos um arquivo SQL.");
  process.exit(1);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(pool) {
  let lastError;

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    try {
      return await pool.connect();
    } catch (error) {
      lastError = error;
      await wait(1000);
    }
  }

  throw lastError;
}

async function main() {
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await connectWithRetry(pool);

  try {
    for (const file of files) {
      const fullPath = path.resolve(file);
      const sql = fs.readFileSync(fullPath, "utf8");
      await client.query(sql);
      console.log(`SQL aplicado: ${path.relative(process.cwd(), fullPath)}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
