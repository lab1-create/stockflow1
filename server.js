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
const appAccessKey = process.env.APP_ACCESS_KEY || "";
const accessCookieName = "stockflow_access";
const accessCookieValue = appAccessKey
  ? crypto.createHash("sha256").update(appAccessKey).digest("hex")
  : "";
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

function parseCookies(header) {
  const cookies = {};
  if (!header) return cookies;
  header.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    if (parts.length === 2) {
      cookies[parts[0].trim()] = parts[1].trim();
    }
  });
  return cookies;
}

function checkAccess(req, res, next) {
  if (!appAccessKey) return next();
  const cookies = parseCookies(req.headers.cookie);
  if (safeEquals(cookies[accessCookieName], accessCookieValue)) {
    return next();
  }
  res.status(401).send("Acesso Bloqueado. Forneça a chave correta.");
}

async function getBootstrap() {
  const client = await pool.connect();
  try {
    // Retorna todos os usuários estruturados com seus pins originais
    const usersRes = await client.query("SELECT name, role, pin FROM app_users ORDER BY name ASC");
    const itemsRes = await client.query("SELECT code, name, category, qty, min, supplier, note FROM items ORDER BY name ASC");
    
    const historyRes = await client.query(
      `SELECT h.id, h.code, i.name as item_name, h.user_name, h.user_role, h.destination_name, h.type, h.quantity, h.created_at 
       FROM history h 
       LEFT JOIN items i ON h.code = i.code 
       ORDER FROM h.created_at DESC LIMIT 200`
    );
    
    const requestsRes = await client.query(
      `SELECT r.id, r.code, i.name as item_name, r.quantity, r.technician_name, r.destination, r.created_at 
       FROM requests r 
       LEFT JOIN items i ON r.code = i.code 
       ORDER BY r.created_at ASC`
    );

    const users = usersRes.rows;
    const technicians = users.filter(u => u.role === "tecnico").map(u => u.name);
    
    const destinationsSet = new Set([
      "Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Bancada 05", "Bancada 06", "Teste"
    ]);

    return {
      users,
      technicians,
      destinations: Array.from(destinationsSet),
      adminName: "Administrador",
      items: itemsRes.rows,
      history: historyRes.rows.map(r => ({
        id: r.id,
        code: r.code,
        itemName: r.item_name || "Item Removido",
        userName: r.user_name,
        userRole: r.user_role,
        destinationName: r.destination_name,
        type: r.type,
        quantity: r.quantity,
        timestamp: new Date(r.created_at).toLocaleString("pt-BR")
      })),
      requests: requestsRes.rows.map(r => ({
        id: r.id,
        code: r.code,
        itemName: r.item_name || "Item Solicitado",
        quantity: r.quantity,
        technicianName: r.technician_name,
        destination: r.destination,
        timestamp: new Date(r.created_at).toLocaleString("pt-BR")
      })),
      usageKpis: []
    };
  } finally {
    client.release();
  }
}

function broadcastState(state) {
  const payload = JSON.stringify({ type: "state", data: state });
  for (const client of liveClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (e) {
      liveClients.delete(client);
    }
  }
}

async function moveStock({ code, userName, userRole, destinationName, type, quantity }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const itemRes = await client.query("SELECT qty, name FROM items WHERE code = $1 FOR UPDATE", [code]);
    if (itemRes.rows.length === 0) {
      throw new Error("Item não encontrado no inventário.");
    }
    
    const currentQty = itemRes.rows[0].qty;
    let newQty = currentQty;

    if (type === "withdrawal") {
      if (currentQty < quantity) {
        throw new Error(`Quantidade insuficiente em estoque.`);
      }
      newQty = currentQty - quantity;
    } else if (type === "return" || type === "replenishment") {
      newQty = currentQty + quantity;
    }

    await client.query("UPDATE items SET qty = $1 WHERE code = $2", [newQty, code]);
    await client.query(
      `INSERT INTO history (code, user_name, user_role, destination_name, type, quantity) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [code, userName, userRole, destinationName, type, quantity]
    );

    await client.query("COMMIT");
    return await getBootstrap();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

app.use(express.static(path.join(__dirname)));

app.get("/api/bootstrap", checkAccess, async (_req, res, next) => {
  try {
    const data = await getBootstrap();
    res.json(data);
  } catch (error) {
    next(error);
  }
});

app.get("/api/live", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  liveClients.add(res);
  req.on("close", () => {
    liveClients.delete(res);
  });
});

app.post("/api/items", checkAccess, async (req, res, next) => {
  try {
    const { originalCode, code, name, category, qty, min, supplier, note } = req.body;
    const client = await pool.connect();
    try {
      if (originalCode) {
        await client.query(
          `UPDATE items SET code = $1, name = $2, category = $3, qty = $4, min = $5, supplier = $6, note = $7 
           WHERE code = $8`,
          [code, name, category, qty, min, supplier, note, originalCode]
        );
      } else {
        await client.query(
          `INSERT INTO items (code, name, category, qty, min, supplier, note) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [code, name, category, qty, min, supplier, note]
        );
      }
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

app.post("/api/movements/withdraw", checkAccess, async (req, res, next) => {
  try {
    const { code, quantity, technician, destination } = req.body;
    const state = await moveStock({
      code,
      userName: technician,
      userRole: "tecnico",
      destinationName: destination || "Bancada",
      type: "withdrawal",
      quantity: quantity || 1
    });
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.post("/api/requests", checkAccess, async (req, res, next) => {
  try {
    const { code, quantity, technicianName, destination } = req.body;
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO requests (code, quantity, technician_name, destination) 
         VALUES ($1, $2, $3, $4)`,
        [code, quantity, technicianName, destination]
      );
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

app.delete("/api/requests/:id", checkAccess, async (req, res, next) => {
  try {
    const client = await pool.connect();
    try {
      await client.query("DELETE FROM requests WHERE id = $1", [req.params.id]);
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

app.post("/api/requests/:id/approve", checkAccess, async (req, res, next) => {
  try {
    const client = await pool.connect();
    let reqRow;
    try {
      const resReq = await client.query("SELECT * FROM requests WHERE id = $1", [req.params.id]);
      if (resReq.rows.length === 0) return res.status(404).json({ error: "Pedido não encontrado" });
      reqRow = resReq.rows[0];
      await client.query("DELETE FROM requests WHERE id = $1", [req.params.id]);
    } finally {
      client.release();
    }

    const state = await moveStock({
      code: reqRow.code,
      userName: reqRow.technician_name,
      userRole: "tecnico",
      destinationName: reqRow.destination,
      type: "withdrawal",
      quantity: reqRow.quantity
    });
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.post("/api/movements/return", checkAccess, async (req, res, next) => {
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

app.post("/api/movements/replenish", checkAccess, async (req, res, next) => {
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

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Erro interno do servidor." });
});

app.listen(port, host, () => {
  console.log(`Servidor rodando em http://${host}:${port}`);
});
