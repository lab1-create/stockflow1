const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    console.log("Iniciando migração de produção...");
    const client = await pool.connect();
    
    try {
        await client.query('BEGIN');

        // Check if unique constraint exists on app_users(name)
        const checkUnique = await client.query(`
            SELECT conname 
            FROM pg_catalog.pg_constraint 
            WHERE conname = 'app_users_name_key'
        `);

        if (checkUnique.rows.length === 0) {
            console.log("Adicionando restrição UNIQUE em app_users(name)...");
            await client.query('ALTER TABLE app_users ADD CONSTRAINT app_users_name_key UNIQUE (name)');
        } else {
            console.log("A restrição UNIQUE app_users_name_key já existe. Pulando.");
        }

        console.log("Garantindo coluna active em destinations...");
        await client.query('ALTER TABLE destinations ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true');

        
        await client.query('COMMIT');
        console.log("Migração concluída com sucesso.");
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Erro durante a migração:", error);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
