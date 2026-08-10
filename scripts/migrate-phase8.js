const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("ERRO: DATABASE_URL não encontrada.");
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
        console.log("Iniciando migração da Fase 8...");
        
        console.log("Adicionando restrição UNIQUE para app_users(name)...");
        await pool.query('ALTER TABLE app_users ADD CONSTRAINT app_users_name_key UNIQUE (name);');
        
        console.log("Migração concluída com sucesso.");
    } catch (e) {
        console.error("Erro durante a migração:", e);
    } finally {
        await pool.end();
    }
}

run();
