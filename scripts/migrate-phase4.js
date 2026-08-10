const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("ERRO: DATABASE_URL não encontrada no ambiente.");
    console.error("Uso: set DATABASE_URL=postgres://... && node scripts/migrate-phase4.js");
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
        console.log("Iniciando migração da Fase 4...");
        
        // 1. Add approved_by column
        console.log("Adicionando colunas de auditoria (approved_by)...");
        await pool.query('ALTER TABLE app_users ADD COLUMN IF NOT EXISTS approved_by UUID;');
        await pool.query('ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS approved_by UUID;');

        // 2. Enable RLS and Lock Down Tables
        console.log("Ativando Row Level Security (RLS) no Supabase...");
        const tables = ['app_users', 'stock_requests', 'supplies', 'stock_movements', 'destinations'];
        
        for (const table of tables) {
            await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
        }

        console.log("As políticas RLS estão vazias (Deny All). Nenhum cliente frontend pode acessar o banco diretamente. Apenas o backend (Server/Node) tem permissão de contorno.");
        
        console.log("Migração concluída com sucesso.");
    } catch (e) {
        console.error("Erro durante a migração:", e);
    } finally {
        await pool.end();
    }
}

run();
