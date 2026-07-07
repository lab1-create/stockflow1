require("dotenv").config();

const path = require("path");
const os = require("os");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { createClient } = require('@supabase/supabase-js');

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

// CONEXÃO OFICIAL COM O SEU SUPABASE
const supabaseUrl = 'https://pqznuarcwiwiodthdksv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxem51YXJjd2l3aW9kdGhka3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTMwNDcsImV4cCI6MjA5ODk2OTA0N30.J2FAa-JcWJuLef6vwI7D3aGu8pwoo1VrKG_RTraHE3Q';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function safeEquals(left, right) {
    const leftBuffer = Buffer.from(String(left || ""));
    const rightBuffer = Buffer.from(String(right || ""));
    if (leftBuffer.length !== rightBuffer.length) return false;
    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function query(text, params) {
    const client = await pool.connect();
    try {
        return await client.query(text, params);
    } finally {
        client.release();
    }
}

async function fetchState() {
    const itemsRes = await query("SELECT * FROM items ORDER BY code ASC", []);
    const historyRes = await query("SELECT * FROM history ORDER BY at DESC LIMIT 100", []);
    const requestsRes = await query("SELECT * FROM requests ORDER BY at DESC", []);
    const kpisRes = await query("SELECT * FROM usage_kpis ORDER BY item_code ASC, technician ASC", []);

    const items = itemsRes.rows.map(r => ({
        code: r.code,
        name: r.name,
        category: r.category,
        qty: Number(r.qty),
        min: Number(r.min),
        supplier: r.supplier,
        note: r.note
    }));

    const history = historyRes.rows.map(r => ({
        at: r.at.toISOString(),
        user: r.user_name,
        type: r.type === "withdrawal" ? "Retirada" : r.type === "return" ? "Devolucao" : "Reposicao",
        qty: Number(r.qty),
        itemCode: r.item_code,
        itemName: r.item_name,
        destination: r.destination_name
    }));

    const requests = requestsRes.rows.map(r => ({
        id: String(r.id),
        at: r.at.toISOString(),
        technician: r.technician,
        itemCode: r.item_code,
        itemName: r.item_name,
        destination: r.destination_name,
        qty: Number(r.qty),
        status: r.status
    }));

    const usageKpis = kpisRes.rows.map(r => ({
        itemCode: r.item_code,
        itemName: r.item_name,
        technician: r.technician,
        averageDays: r.average_days ? Number(r.average_days) : null
    }));

    return {
        items,
        history,
        requests,
        usageKpis,
        users: [
            { name: "Administrador", role: "admin" },
            { name: "Luiz", role: "tecnico" },
            { name: "Henrique", role: "tecnico" },
            { name: "Joao", role: "tecnico" },
            { name: "Gabriel", role: "tecnico" }
        ],
        technicians: ["Luiz", "Henrique", "Joao", "Gabriel"],
        destinations: ["Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Servico interno", "Estoque de testes", "Outro"],
        adminName: "Administrador"
    };
}

function broadcastState(state) {
    const payload = JSON.stringify({ type: "state", data: state });
    for (const client of liveClients) {
        client.write(`event: state\ndata: ${payload}\n\n`);
    }
}

async function moveStock({ code, userName, userRole, destinationName, type, quantity }) {
    const itemsRes = await query("SELECT * FROM items WHERE LOWER(code) = LOWER($1)", [code]);
    if (itemsRes.rowCount === 0) throw new Error("Insumo nao encontrado.");
    const item = itemsRes.rows[0];

    let nextQty = Number(item.qty);
    if (type === "withdrawal") {
        if (nextQty < quantity) throw new Error("Estoque insuficiente.");
        nextQty -= quantity;
    } else if (type === "return" || type === "replenishment") {
        nextQty += quantity;
    }

    await query("UPDATE items SET qty = $1 WHERE id = $2", [nextQty, item.id]);
    await query(
        "INSERT INTO history (user_name, user_role, type, item_code, item_name, destination_name, qty, at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())",
        [userName, userRole, type, item.code, item.name, destinationName, quantity]
    );

    return await fetchState();
}

app.get("/api/bootstrap", async (req, res, next) => {
    try {
        res.json(await fetchState());
    } catch (error) {
        next(error);
    }
});

app.post("/api/login", async (req, res) => {
    const { name, pin } = req.body;
    const users = [
        { name: "Administrador", role: "admin" },
        { name: "Luiz", role: "tecnico" },
        { name: "Henrique", role: "tecnico" },
        { name: "Joao", role: "tecnico" },
        { name: "Gabriel", role: "tecnico" }
    ];

    const user = users.find((u) => u.name.toLowerCase() === (name || "").trim().toLowerCase());
    if (!user) return res.status(400).json({ error: "Usuario nao encontrado." });

    const expectedPin = user.role === "admin" ? "0000" : "1111";
    if (pin !== expectedPin) return res.status(400).json({ error: "PIN incorreto." });

    try {
        const state = await fetchState();
        res.json({ user, state });
    } catch {
        res.json({ user, state: {} });
    }
});

app.get("/api/events", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive"
    });
    res.write("\n");
    liveClients.add(res);
    req.on("close", () => {
        liveClients.delete(res);
    });
});

app.post("/api/movements/withdraw", async (req, res, next) => {
    try {
        const { code, technician, destination, quantity } = req.body;
        const itemsRes = await query("SELECT * FROM items WHERE LOWER(code) = LOWER($1)", [code]);
        if (itemsRes.rowCount === 0) throw new Error("Insumo nao encontrado.");
        const item = itemsRes.rows[0];

        const reqRes = await query(
            "INSERT INTO requests (technician, item_code, item_name, destination_name, qty, status, at) VALUES ($1, $2, $3, $4, $5, 'pending', NOW()) RETURNING id",
            [technician, item.code, item.name, destination, quantity]
        );

        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        next(error);
    }
});

app.post("/api/requests/:id/approve", async (req, res, next) => {
    try {
        const { id } = req.params;
        const reqsRes = await query("SELECT * FROM requests WHERE id = $1", [id]);
        if (reqsRes.rowCount === 0) throw new Error("Solicitacao nao encontrada.");
        const request = reqsRes.rows[0];

        if (request.status !== "pending") {
            res.json(await fetchState());
            return;
        }

        await query("UPDATE requests SET status = 'approved' WHERE id = $1", [id]);
        const state = await moveStock({
            code: request.item_code,
            userName: request.technician,
            userRole: "tecnico",
            destinationName: request.destination_name,
            type: "withdrawal",
            quantity: Number(request.qty)
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

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message || "Erro interno no servidor." });
});

app.listen(port, host, () => {
    console.log(`Servidor rodando em http://${host}:${port}`);
});