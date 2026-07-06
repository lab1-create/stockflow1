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
  return String(header || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separator = part.indexOf("=");
      if (separator === -1) return cookies;
      cookies[decodeURIComponent(part.slice(0, separator))] = decodeURIComponent(part.slice(separator + 1));
      return cookies;
    }, {});
}

function renderAccessPage(res, error = "") {
  res.status(error ? 401 : 200).send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>StockFlow - Acesso</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #101820; color: #f8fafc; }
    form { width: min(360px, calc(100vw - 32px)); display: grid; gap: 14px; padding: 28px; background: #172331; border: 1px solid #2c3f54; border-radius: 8px; }
    h1 { margin: 0; font-size: 24px; }
    p { margin: 0; color: #b9c4d0; }
    input, button { height: 44px; border-radius: 6px; font-size: 16px; }
    input { border: 1px solid #40566f; background: #0f1720; color: #f8fafc; padding: 0 12px; }
    button { border: 0; background: #39a96b; color: #07110b; font-weight: 700; cursor: pointer; }
    .error { color: #ffb4a8; min-height: 20px; }
  </style>
</head>
<body>
  <form method="post" action="/access">
    <h1>StockFlow</h1>
    <p>Digite a chave de acesso para entrar.</p>
    <input name="accessKey" type="password" autocomplete="current-password" autofocus required>
    <button>Entrar</button>
    <p class="error">${error}</p>
  </form>
</body>
</html>`);
}

function requireAccessKey(req, res, next) {
  if (!appAccessKey || req.path === "/api/health") return next();

  const cookies = parseCookies(req.headers.cookie);
  if (safeEquals(cookies[accessCookieName], accessCookieValue)) return next();

  if (req.path.startsWith("/api/")) {
    return res.status(401).json({ error: "Chave de acesso obrigatoria." });
  }

  return renderAccessPage(res);
}

app.post("/access", (req, res) => {
  if (!appAccessKey) return res.redirect("/");

  if (!safeEquals(req.body.accessKey, appAccessKey)) {
    return renderAccessPage(res, "Chave invalida.");
  }

  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.cookie(accessCookieName, accessCookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: 1000 * 60 * 60 * 24 * 30
  });
  return res.redirect("/");
});

app.use(requireAccessKey);
app.use(express.static(__dirname));

function mapSupply(row) {
  return {
    code: row.code,
    name: row.name,
    category: row.category,
    qty: row.current_quantity,
    min: row.minimum_quantity,
    supplier: row.supplier || "",
    note: row.note || ""
  };
}

function mapMovement(row) {
  const typeLabels = {
    withdrawal: "Retirada",
    return: "Devolucao",
    replenishment: "Reposicao",
    adjustment: "Ajuste"
  };

  return {
    at: row.created_at,
    user: row.user_name || "Sistema",
    type: typeLabels[row.movement_type] || row.movement_type,
    qty: row.quantity,
    itemCode: row.code,
    itemName: row.supply_name,
    destination: row.destination_name || "Estoque"
  };
}

function mapRequest(row) {
  return {
    id: row.id,
    at: row.requested_at,
    technician: row.user_name,
    itemCode: row.code,
    itemName: row.supply_name,
    destination: row.destination_name || "Estoque",
    qty: row.quantity,
    status: row.status
  };
}

function sendLiveEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastState(state) {
  for (const client of liveClients) {
    sendLiveEvent(client, "state", state);
  }
}

async function getBootstrap() {
  const [users, destinations, supplies, movements, requests, usage] = await Promise.all([
    pool.query("SELECT name, role FROM app_users WHERE active = TRUE ORDER BY role, name"),
    pool.query("SELECT name FROM destinations WHERE active = TRUE AND name <> 'Estoque' ORDER BY name"),
    pool.query("SELECT * FROM supplies ORDER BY name"),
    pool.query(`
      SELECT sm.*, s.code, s.name AS supply_name, u.name AS user_name, d.name AS destination_name
      FROM stock_movements sm
      JOIN supplies s ON s.id = sm.supply_id
      LEFT JOIN app_users u ON u.id = sm.user_id
      LEFT JOIN destinations d ON d.id = sm.destination_id
      ORDER BY sm.created_at DESC
      LIMIT 80
    `),
    pool.query(`
      SELECT sr.*, s.code, s.name AS supply_name, u.name AS user_name, d.name AS destination_name
      FROM stock_requests sr
      JOIN supplies s ON s.id = sr.supply_id
      JOIN app_users u ON u.id = sr.user_id
      LEFT JOIN destinations d ON d.id = sr.destination_id
      WHERE sr.status = 'pending'
      ORDER BY sr.requested_at DESC
      LIMIT 50
    `),
    pool.query(`
      WITH ordered AS (
        SELECT
          sm.created_at,
          s.code,
          s.name AS supply_name,
          u.name AS user_name,
          lag(sm.created_at) OVER (PARTITION BY sm.supply_id, sm.user_id ORDER BY sm.created_at) AS previous_at
        FROM stock_movements sm
        JOIN supplies s ON s.id = sm.supply_id
        JOIN app_users u ON u.id = sm.user_id
        WHERE sm.movement_type = 'withdrawal'
      )
      SELECT
        code,
        supply_name,
        user_name,
        round(avg(extract(epoch FROM (created_at - previous_at)) / 86400))::int AS average_days,
        min(extract(epoch FROM (created_at - previous_at)) / 86400)::int AS shortest_days,
        max(created_at) AS last_at
      FROM ordered
      WHERE previous_at IS NOT NULL
      GROUP BY code, supply_name, user_name
      ORDER BY average_days ASC NULLS LAST, supply_name
      LIMIT 30
    `)
  ]);

  return {
    users: users.rows,
    technicians: users.rows.filter((row) => row.role === "tecnico").map((row) => row.name),
    destinations: destinations.rows.map((row) => row.name),
    adminName: "Administrador",
    items: supplies.rows.map(mapSupply),
    history: movements.rows.map(mapMovement),
    requests: requests.rows.map(mapRequest),
    usageKpis: usage.rows.map((row) => ({
      itemCode: row.code,
      itemName: row.supply_name,
      technician: row.user_name,
      averageDays: row.average_days,
      shortestDays: row.shortest_days,
      lastAt: row.last_at
    }))
  };
}

async function findOrCreateUser(client, name, role) {
  const result = await client.query(
    `
      INSERT INTO app_users (name, role)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET active = TRUE
      RETURNING id
    `,
    [name, role]
  );
  return result.rows[0].id;
}

async function findOrCreateDestination(client, name) {
  const result = await client.query(
    `
      INSERT INTO destinations (name)
      VALUES ($1)
      ON CONFLICT (name) DO UPDATE SET active = TRUE
      RETURNING id
    `,
    [name]
  );
  return result.rows[0].id;
}

async function moveStock({ code, userName, userRole, destinationName, type, quantity }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const supplyResult = await client.query("SELECT * FROM supplies WHERE lower(code) = lower($1) FOR UPDATE", [code]);
    const supply = supplyResult.rows[0];

    if (!supply) {
      const error = new Error("Insumo nao encontrado.");
      error.status = 404;
      throw error;
    }

    const amount = Number(quantity || 1);
    const before = Number(supply.current_quantity);
    let after = before;

    if (type === "withdrawal") after = before - amount;
    if (type === "return" || type === "replenishment") after = before + amount;

    if (amount <= 0 || !Number.isInteger(amount)) {
      const error = new Error("Quantidade invalida.");
      error.status = 400;
      throw error;
    }

    if (after < 0) {
      const error = new Error("Estoque insuficiente.");
      error.status = 409;
      throw error;
    }

    const userId = await findOrCreateUser(client, userName, userRole);
    const destinationId = await findOrCreateDestination(client, destinationName || "Estoque");

    await client.query("UPDATE supplies SET current_quantity = $1 WHERE id = $2", [after, supply.id]);
    await client.query(
      `
        INSERT INTO stock_movements
          (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [supply.id, userId, destinationId, type, amount, before, after]
    );

    await client.query("COMMIT");
    return getBootstrap();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createStockRequest({ code, technician, destination, quantity }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const supply = (await client.query("SELECT id FROM supplies WHERE lower(code) = lower($1)", [code])).rows[0];
    if (!supply) {
      const error = new Error("Insumo nao encontrado.");
      error.status = 404;
      throw error;
    }

    const amount = Number(quantity || 1);
    if (amount <= 0 || !Number.isInteger(amount)) {
      const error = new Error("Quantidade invalida.");
      error.status = 400;
      throw error;
    }

    const userId = await findOrCreateUser(client, technician, "tecnico");
    const destinationId = await findOrCreateDestination(client, destination || "Estoque");

    await client.query(
      `
        INSERT INTO stock_requests (supply_id, user_id, destination_id, quantity)
        VALUES ($1, $2, $3, $4)
      `,
      [supply.id, userId, destinationId, amount]
    );

    await client.query("COMMIT");
    return getBootstrap();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function approveStockRequest({ requestId, scannedCode, adminName }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const request = (await client.query(
      `
        SELECT sr.*, s.code, s.current_quantity
        FROM stock_requests sr
        JOIN supplies s ON s.id = sr.supply_id
        WHERE sr.id = $1 AND sr.status = 'pending'
        FOR UPDATE
      `,
      [requestId]
    )).rows[0];

    if (!request) {
      const error = new Error("Solicitacao pendente nao encontrada.");
      error.status = 404;
      throw error;
    }

    if (request.code.toLowerCase() !== String(scannedCode || "").toLowerCase()) {
      const error = new Error("Codigo bipado nao corresponde a solicitacao.");
      error.status = 409;
      throw error;
    }

    const before = Number(request.current_quantity);
    const amount = Number(request.quantity);
    const after = before - amount;
    if (after < 0) {
      const error = new Error("Estoque insuficiente.");
      error.status = 409;
      throw error;
    }

    const adminId = await findOrCreateUser(client, adminName || "Administrador", "admin");

    await client.query("UPDATE supplies SET current_quantity = $1 WHERE id = $2", [after, request.supply_id]);
    await client.query(
      `
        INSERT INTO stock_movements
          (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after)
        VALUES ($1, $2, $3, 'withdrawal', $4, $5, $6)
      `,
      [request.supply_id, request.user_id, request.destination_id, amount, before, after]
    );
    await client.query(
      `
        UPDATE stock_requests
        SET status = 'approved', approved_at = now(), approved_by = $1
        WHERE id = $2
      `,
      [adminId, request.id]
    );

    await client.query("COMMIT");
    return getBootstrap();
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/bootstrap", async (_req, res, next) => {
  try {
    res.json(await getBootstrap());
  } catch (error) {
    next(error);
  }
});

app.get("/api/events", async (req, res, next) => {
  try {
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });
    res.flushHeaders?.();

    liveClients.add(res);
    sendLiveEvent(res, "state", await getBootstrap());

    const keepAlive = setInterval(() => {
      sendLiveEvent(res, "ping", { at: new Date().toISOString() });
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      liveClients.delete(res);
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const { name, pin } = req.body;
    const result = await pool.query(
      "SELECT name, role FROM app_users WHERE name = $1 AND pin_code = $2 AND active = TRUE",
      [name, pin]
    );

    if (!result.rows[0]) {
      return res.status(401).json({ error: "Usuario ou PIN invalido." });
    }

    res.json({ user: result.rows[0], state: await getBootstrap() });
  } catch (error) {
    next(error);
  }
});

// Novo endpoint para Criação/Cadastro de Usuários via Painel Administrativo
app.post("/api/usuarios", async (req, res, next) => {
  try {
    const { name, role, pin } = req.body;

    if (!name || !role || !pin) {
      return res.status(400).json({ error: "Todos os campos (Nome, Cargo e PIN) são obrigatórios." });
    }

    // Insere ou atualiza o PIN/Cargo caso o usuário já exista (sincronizado com o comportamento do banco)
    await pool.query(
      `
        INSERT INTO app_users (name, role, pin_code, active)
        VALUES ($1, $2, $3, TRUE)
        ON CONFLICT (name) DO UPDATE SET
          role = EXCLUDED.role,
          pin_code = EXCLUDED.pin_code,
          active = TRUE
      `,
      [name, role, pin]
    );

    const state = await getBootstrap();
    broadcastState(state);
    res.json(state);
  } catch (error) {
    next(error);
  }
});

app.post("/api/items", async (req, res, next) => {
  try {
    const item = req.body;
    await pool.query(
      `
        INSERT INTO supplies (code, name, category, current_quantity, minimum_quantity, supplier, note)
        VALUES (upper($1), $2, $3, $4, $5, $6, $7)
        ON CONFLICT (code) DO UPDATE SET
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          current_quantity = EXCLUDED.current_quantity,
          minimum_quantity = EXCLUDED.minimum_quantity,
          supplier = EXCLUDED.supplier,
          note = EXCLUDED.note
      `,
      [item.code, item.name, item.category, item.qty, item.min, item.supplier || "", item.note || ""]
    );
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
    const state = await createStockRequest({
      code,
      technician,
      destination,
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
    const state = await approveStockRequest({
      requestId: req.params.id,
      scannedCode: req.body.code,
      adminName: req.body.adminName
    });
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

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    error: error.message || "Erro interno."
  });
});

app.listen(port, host, () => {
  const computerName = os.hostname();
  console.log("StockFlow rodando.");
  console.log(`Nesta maquina: http://localhost:${port}`);
  console.log(`Na rede, sem IP: http://${computerName}:${port}`);
});
