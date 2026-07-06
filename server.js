// ... (mantenha os requires e imports do topo iguais)

const app = express();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL === "true" || /sslmode=require/i.test(databaseUrl || "");

// CONFIGURAÇÃO DO POOL OTIMIZADA PARA EVITAR QUEDAS NO RENDER
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : undefined,
  connectionTimeoutMillis: 10000, // Espera até 10 segundos antes de dar timeout
  idleTimeoutMillis: 30000,       // Fecha conexões inativas após 30 segundos
  max: 10                         // Limite máximo de conexões simultâneas
});

const liveClients = new Set();

// ... (mantenha as funções safeEquals e a estrutura interna de initDatabase iguais)

// Inicialização segura e completa de todas as estruturas do Banco de Dados
async function initDatabase() {
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // 1. Tabela de usuários do app
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        name TEXT PRIMARY KEY,
        role TEXT,
        pin_code TEXT,
        active BOOLEAN DEFAULT TRUE
      );
    `);

    // 2. Tabela de destinos operacionais
    await client.query(`
      CREATE TABLE IF NOT EXISTS destinations (
        name TEXT PRIMARY KEY
      );
    `);

    // 3. Tabela de itens/insumos no estoque
    await client.query(`
      CREATE TABLE IF NOT EXISTS items (
        code TEXT PRIMARY KEY,
        name TEXT,
        category TEXT,
        qty INT DEFAULT 0,
        min INT DEFAULT 0,
        supplier TEXT,
        note TEXT
      );
    `);

    // 4. Tabela de solicitações pendentes
    await client.query(`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        technician TEXT,
        item_code TEXT,
        item_name TEXT,
        destination TEXT,
        qty INT DEFAULT 1,
        status TEXT DEFAULT 'pending'
      );
    `);

    // 5. Tabela de histórico de movimentações
    await client.query(`
      CREATE TABLE IF NOT EXISTS stock_history (
        id SERIAL PRIMARY KEY,
        at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_name TEXT,
        type TEXT,
        qty INT,
        item_code TEXT,
        item_name TEXT,
        destination TEXT
      );
    `);

    // Limpeza de usuários de teste obsoletos se necessário
    await client.query("DELETE FROM app_users WHERE name = 'Gabriel'");

    // Carga de usuários operacionais obrigatórios
    const originalUsers = [
      { name: "Administrador", role: "admin", pin: "Out@adm" },
      { name: "Luiz", role: "tecnico", pin: "1111" },
      { name: "Bruno", role: "tecnico", pin: "1111" },
      { name: "Joao", role: "tecnico", pin: "1111" },
      { name: "Placo", role: "tecnico", pin: "1111" },
      { name: "Kaique", role: "tecnico", pin: "1111" },
      { name: "Cauã", role: "tecnico", pin: "1111" }
    ];

    for (const u of originalUsers) {
      await client.query(`
        INSERT INTO app_users (name, role, pin_code, active)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (name) DO UPDATE SET role = EXCLUDED.role, pin_code = EXCLUDED.pin_code, active = TRUE
      `, [u.name, u.role, u.pin]);
    }

    const baseDestinations = [
      "Bancada 01", "Bancada 02", "Bancada 03", 
      "Bancada 04", "Bancada 05", "Bancada 06", "Teste"
    ];

    for (const dest of baseDestinations) {
      await client.query("INSERT INTO destinations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [dest]);
    }

    await client.query("COMMIT");
    console.log(">> Banco de dados inicializado com sucesso!");
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Erro na inicialização do banco (Servidor continuará rodando):", err.message);
  } finally {
    if (client) client.release();
  }
}

// Chamar de forma segura para não derrubar a aplicação caso a rede falhe temporariamente
initDatabase().catch(err => console.error("Falha fatal na inicialização:", err));

// ... (mantenha o restante do arquivo idêntico)
