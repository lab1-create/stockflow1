require("dotenv").config();

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL === "true" || /sslmode=require/i.test(databaseUrl || "");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : undefined
});

const liveClients = new Set();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function safeEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

// Inicialização segura e completa de todas as estruturas do Banco de Dados
async function initDatabase() {
  const client = await pool.connect();
  try {
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
    console.log(">> Banco de dados inicializado com sucesso e todas as tabelas criadas!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Erro crítico na inicialização das tabelas do banco:", err.message);
  } finally {
    client.release();
  }
}

// Executa a criação das tabelas antes de qualquer requisição externa
initDatabase();

function broadcastState(state) {
  const payload = `data: ${JSON.stringify(state)}\n\n`;
  for (const res of liveClients) {
    try {
      res.write(payload);
    } catch {
      liveClients.delete(res);
    }
  }
}

async function getBootstrap() {
  const client = await pool.connect();
  try {
    const usersRes = await client.query("SELECT name, role FROM app_users WHERE active = TRUE ORDER BY name ASC");
    const itemsRes = await client.query("SELECT code, name, category, qty, min, supplier, note FROM items ORDER BY name ASC");
    const historyRes = await client.query("SELECT at, user_name as user, type, qty, item_code as \"itemCode\", item_name as \"itemName\", destination FROM stock_history ORDER BY at DESC LIMIT 100");
    const requestsRes = await client.query("SELECT id, at, technician, item_code as \"itemCode\", item_name as \"itemName\", destination, qty, status FROM requests WHERE status = 'pending' ORDER BY at DESC");

    const destsRes = await client.query("SELECT name FROM destinations ORDER BY name ASC");
    const destinations = destsRes.rows.map(d => d.name);

    let usageKpis = [];
    try {
      const kpisRes = await client.query(`
        SELECT item_code as "itemCode", item_name as "itemName", user_name as technician,
               CEIL(AVG(days_step))::INT as "averageDays"
        FROM (
          SELECT item_code, item_name, user_name,
                 EXTRACT(DAY FROM (at - LAG(at) OVER (PARTITION BY item_code, user_name ORDER BY at ASC))) as days_step
          FROM stock_history
          WHERE type = 'Retirada'
        ) sub
        WHERE days_step IS NOT NULL AND days_step > 0
        GROUP BY item_code, item_name, user_name
        ORDER BY "averageDays" ASC
      `);
      usageKpis = kpisRes.rows;
    } catch (kpiError) {
      // Ignora de forma segura se não houver dados suficientes no histórico
    }

    return {
      users: usersRes.rows,
      technicians: usersRes.rows.filter(u => u.role === "tecnico").map(u => u.name),
      destinations: destinations.length > 0 ? destinations : ["Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Bancada 05", "Bancada 06", "Teste"],
      items: itemsRes.rows,
      history: historyRes.rows,
      requests: requestsRes.rows,
      usageKpis: usageKpis,
      adminName: "Administrador"
    };
  } finally {
    client.release();
  }
}

async function moveStock({ code, userName, userRole, destinationName, type, quantity }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const itemRes = await client.query("SELECT code, name, qty FROM items WHERE UPPER(code) = UPPER($1) FOR UPDATE", [code.trim()]);
    if (itemRes.rows.length === 0) throw new Error("Insumo não encontrado.");

    const item = itemRes.rows[0];
    const qtyChange = Number(quantity || 1);
    let nextQty = Number(item.qty);

    if (type === "withdraw") {
      if (userRole === "admin") {
        nextQty -= qtyChange;
        await client.query("UPDATE items SET qty = $1 WHERE code = $2", [nextQty, item.code]);
        await client.query(`
          INSERT INTO stock_history (at, user_name, type, qty, item_code, item_name, destination)
          VALUES (CURRENT_TIMESTAMP, $1, 'Retirada', $2, $3, $4, $5)
        `, [userName, qtyChange, item.code, item.name, destinationName]);
      } else {
        await client.query(`
          INSERT INTO requests (at, technician, item_code, item_name, destination, qty, status)
          VALUES (CURRENT_TIMESTAMP, $1, $2, $3, $4, $5, 'pending')
        `, [userName, item.code, item.name, destinationName, qtyChange]);
      }
    } else if (type === "return") {
      nextQty += qtyChange;
      await client.query("UPDATE items SET qty = $1 WHERE code = $2", [nextQty, item.code]);
      await client.query(`
        INSERT INTO stock_history (at, user_name, type, qty, item_code, item_name, destination)
        VALUES (CURRENT_TIMESTAMP, $1, 'Devolução', $2, $3, $4, 'Estoque')
      `, [userName, qtyChange, item.code, item.name]);
    } else if (type === "replenishment") {
      nextQty += qtyChange;
      await client.query("UPDATE items SET qty = $1 WHERE code = $2", [nextQty, item.code]);
      await client.query(`
        INSERT INTO stock_history (at, user_name, type, qty, item_code, item_name, destination)
        VALUES (CURRENT_TIMESTAMP, 'Administrador', 'Reposição', $2, $3, $4, 'Estoque')
      `, [userName, qtyChange, item.code, item.name]);
    }

    await client.query("COMMIT");
    return await getBootstrap();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

app.get("/api/bootstrap", async (_req, res, next) => {
  try {
    res.json(await getBootstrap());
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  liveClients.add(res);
  req.on("close", () => {
    liveClients.delete(res);
  });
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { name, pin } = req.body;
    const client = await pool.connect();

    let user;
    try {
      const userRes = await client.query("SELECT name, role, pin_code FROM app_users WHERE name = $1 AND active = TRUE", [name]);
      if (userRes.rows.length > 0) user = userRes.rows[0];
    } finally {
      client.release();
    }

    if (!user) return res.status(401).json({ error: "Usuário não encontrado." });

    const isDbPinMatch = user.pin_code && safeEquals(user.pin_code, pin);
    const isFallbackAdmin = user.role === "admin" && safeEquals("Out@adm", pin);
    const isFallbackTecnico = user.role === "tecnico" && (safeEquals("1111", pin) || safeEquals("Out2021adm", pin));

    if (!isDbPinMatch && !isFallbackAdmin && !isFallbackTecnico) {
      return res.status(401).json({ error: "PIN incorreto." });
    }

    res.json({
      user: { name: user.name, role: user.role },
      state: await getBootstrap()
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/items", async (req, res, next) => {
  try {
    const { code, name, category, qty, min, supplier, note } = req.body;
    const client = await pool.connect();
    try {
      await client.query(`
        INSERT INTO items (code, name, category, qty, min, supplier, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          qty = EXCLUDED.qty,
          min = EXCLUDED.min,
          supplier = EXCLUDED.supplier,
          note = EXCLUDED.note
      `, [code.trim().toUpperCase(), name, category, qty, min, supplier, note]);
    } finally {
      client.release();
    }
    const state = await getBootstrap();
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.post("/api/movements/withdraw", async (req, res, next) => {
  try {
    const { code, technician, destination, quantity } = req.body;
    const state = await moveStock({
      code,
      userName: technician,
      userRole: "tecnico",
      destinationName: destination,
      type: "withdraw",
      quantity
    });
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.post("/api/requests/:id/approve", async (req, res, next) => {
  try {
    const { code, adminName } = req.body;
    const requestId = req.params.id;

    const client = await pool.connect();
    let state;
    try {
      await client.query("BEGIN");
      
      const reqRes = await client.query("SELECT item_code, item_name, technician, destination, qty FROM requests WHERE id = $1 AND status = 'pending' FOR UPDATE", [requestId]);
      if (reqRes.rows.length === 0) throw new Error("Solicitação pendente não encontrada.");

      const request = reqRes.rows[0];
      
      if (code && request.item_code.trim().toUpperCase() !== code.trim().toUpperCase()) {
        throw new Error(`Código escaneado (${code.trim().toUpperCase()}) difere do solicitado (${request.item_code.trim().toUpperCase()}).`);
      }

      const itemRes = await client.query("SELECT qty FROM items WHERE code = $1 FOR UPDATE", [request.item_code]);
      if (itemRes.rows.length === 0 || Number(itemRes.rows[0].qty) < Number(request.qty)) {
        throw new Error("Estoque insuficiente para aprovação.");
      }

      await client.query("UPDATE items SET qty = qty - $1 WHERE code = $2", [request.qty, request.item_code]);
      await client.query("UPDATE requests SET status = 'approved' WHERE id = $1", [requestId]);
      await client.query(`
        INSERT INTO stock_history (at, user_name, type, qty, item_code, item_name, destination)
        VALUES (CURRENT_TIMESTAMP, $1, 'Retirada', $2, $3, $4, $5)
      `, [request.technician, request.qty, request.item_code, request.item_name, request.destination]);

      await client.query("COMMIT");
      state = await getBootstrap();
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.post("/api/movements/return", async (req, res, next) => {
  try {
    const { code, quantity, technician } = req.body;
    const state = await moveStock({
      code,
      userName: technician || "Tecnico",
      userRole: "tecnico",
      destinationName: "Estoque",
      type: "return",
      quantity: quantity || 1
    });
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.post("/api/movements/replenish", async (req, res, next) => {
  try {
    const { code, quantity } = req.body;
    const state = await moveStock({
      code,
      userName: "Administrador",
      userRole: "admin",
      destinationName: "Estoque",
      type: "replenishment",
      quantity
    });
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(__dirname)));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error("Erro na requisição:", error);
  res.status(500).json({ error: error.message || "Erro interno do servidor." });
});

app.listen(port, host, () => {
  console.log(`Servidor rodando com sucesso em http://${host}:${port}`);
});
