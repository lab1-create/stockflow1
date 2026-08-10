const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    console.error("ERRO: DATABASE_URL não encontrada no ambiente.");
    console.error("Uso: set DATABASE_URL=postgres://... && node scripts/migrate-pins.js");
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
        console.log("Iniciando migração de PINs...");
        const res = await pool.query('SELECT id, name, pin_code FROM app_users');
        
        let count = 0;
        for (const user of res.rows) {
            if (user.pin_code && !user.pin_code.startsWith('$2b$')) {
                const hashed = await bcrypt.hash(String(user.pin_code), 10);
                await pool.query('UPDATE app_users SET pin_code = $1 WHERE id = $2', [hashed, user.id]);
                console.log(`PIN de '${user.name}' sofreu hash com sucesso.`);
                count++;
            }
        }
        
        console.log(`Migração concluída. ${count} usuários atualizados.`);
    } catch (e) {
        console.error("Erro durante a migração:", e);
    } finally {
        await pool.end();
    }
}

run();
