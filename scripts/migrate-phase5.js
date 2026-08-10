const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("ERRO: DATABASE_URL não encontrada no ambiente.");
    console.error("Uso: set DATABASE_URL=postgres://... && node scripts/migrate-phase5.js");
    process.exit(1);
}

let pgUrl = connectionString;
if (!pgUrl.includes("sslmode=")) {
    if (pgUrl.includes("supabase.pool.pooler.supabase.com")) {
        pgUrl += pgUrl.includes("?") ? "&sslmode=require" : "?sslmode=require";
    }
}

const pool = new Pool({
    connectionString: pgUrl,
    ssl: pgUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : false
});

async function run() {
    try {
        console.log("Iniciando migração da Fase 5...");
        
        console.log("Removendo DEFAULT '1111' da coluna pin_code na tabela app_users...");
        await pool.query('ALTER TABLE app_users ALTER COLUMN pin_code DROP DEFAULT;');
        
        console.log("Migração concluída com sucesso.");
    } catch (e) {
        console.error("Erro durante a migração:", e);
    } finally {
        await pool.end();
    }
}

run();
