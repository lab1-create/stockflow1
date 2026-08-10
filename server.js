const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const port = Number(process.env.PORT || 4173);
const host = "0.0.0.0";
const liveClients = new Set();
if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET não configurado no ambiente.");
}
const JWT_SECRET = process.env.JWT_SECRET || "fallback-for-local-dev-only-change-me";

let connectionString = process.env.DATABASE_URL;
if (connectionString && !connectionString.includes("sslmode=")) {
    if (connectionString.includes("supabase.pool.pooler.supabase.com")) {
        connectionString += connectionString.includes("?") ? "&sslmode=require" : "?sslmode=require";
    }
}

function validatePositiveInteger(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n <= 0) return null;
    return n;
}

function validateNonNegativeInteger(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return null;
    return n;
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    throw new Error("FRONTEND_URL obrigatório em produção");
}
const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : true;
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet({
    contentSecurityPolicy: false // disabled to prevent breaking frontend for now
}));
app.use(express.static(path.join(__dirname, 'Public')));

// Auth Middlewares
async function verifyToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ error: "Acesso negado. Faça login." });
    try {
        const verified = jwt.verify(token, JWT_SECRET);
        const userCheck = await pool.query('SELECT active, role FROM app_users WHERE id = $1', [verified.id]);
        if (userCheck.rows.length === 0 || !userCheck.rows[0].active) {
            return res.status(401).json({ error: "Usuário desativado ou removido." });
        }
        verified.role = userCheck.rows[0].role; // refresh role from DB
        req.user = verified;
        next();
    } catch (err) {
        res.status(400).json({ error: "Sessão inválida ou expirada." });
    }
}

function verifyAdmin(req, res, next) {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: "Acesso restrito a administradores." });
        }
        next();
    });
}

// Buscar estado consolidado das tabelas do Supabase
async function fetchState() {
    try {
        const usersResult = await pool.query('SELECT id, name, role, active FROM app_users ORDER BY name ASC');
        const destinationsResult = await pool.query('SELECT id, name FROM destinations WHERE active = true');
        const suppliesResult = await pool.query('SELECT id, code, name, category, current_quantity FROM supplies ORDER BY code ASC');
        
        const movResult = await pool.query(`
            SELECT sm.id, sm.supply_id, sm.user_id, sm.destination_id, sm.movement_type, 
                   sm.quantity, sm.note, sm.created_at,
                   s.code, s.name as supply_name, u.name as user_name, d.name as dest_name
            FROM stock_movements sm
            LEFT JOIN supplies s ON sm.supply_id = s.id
            LEFT JOIN app_users u ON sm.user_id = u.id
            LEFT JOIN destinations d ON sm.destination_id = d.id
            ORDER BY sm.created_at DESC LIMIT 100
        `);

        const reqResult = await pool.query(`
            SELECT sr.id, sr.supply_id, sr.user_id, sr.destination_id, sr.quantity, sr.status, sr.requested_at,
                   s.code, s.name as supply_name, u.name as user_name, d.name as dest_name
            FROM stock_requests sr
            LEFT JOIN supplies s ON sr.supply_id = s.id
            LEFT JOIN app_users u ON sr.user_id = u.id
            LEFT JOIN destinations d ON sr.destination_id = d.id
            ORDER BY sr.requested_at DESC
        `);

        return { 
            users: usersResult.rows, 
            destinations: destinationsResult.rows.map(d => d.name), 
            supplies: suppliesResult.rows, 
            movements: movResult.rows, 
            requests: reqResult.rows 
        };
    } catch (error) {
        console.error('❌ Erro crítico ao buscar dados no Supabase:', error);
        return { users: [], destinations: [], supplies: [], movements: [], requests: [] };
    }
}

function broadcastState(state) {
    const payload = JSON.stringify({ type: "state", data: state });
    for (const client of liveClients) {
        client.write(`event: state\ndata: ${payload}\n\n`);
    }
}

// ---- ENDPOINTS DA API ----
app.get("/api/bootstrap", verifyToken, async (req, res, next) => {
    try { res.json(await fetchState()); } catch (error) { next(error); }
});

// Auth endpoints
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // Limite de 10 cadastros por IP por hora
    message: { error: "Muitas tentativas de cadastro a partir deste IP. Tente novamente mais tarde." }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min
    max: 10, // 10 attempts
    message: { error: "Muitas tentativas. Tente novamente mais tarde." }
});

app.post("/api/auth/login", loginLimiter, async (req, res) => {
    try {
        const { name, pin } = req.body;
        if (!name || !pin) return res.status(400).json({ error: "Nome e PIN obrigatórios." });

        const result = await pool.query('SELECT id, name, role, pin_code, active FROM app_users WHERE name = $1', [name]);
        if (result.rows.length === 0) return res.status(400).json({ error: "Usuário não encontrado." });

        const user = result.rows[0];
        if (!user.active) return res.status(400).json({ error: "Seu acesso ainda não foi aprovado pelo administrador." });
        
        const validPin = await bcrypt.compare(String(pin), user.pin_code);
        if (!validPin) return res.status(400).json({ error: "PIN incorreto." });

        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
        res.cookie("token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" });
        
        const state = await fetchState();
        res.json({ user: { id: user.id, name: user.name, role: user.role }, state });
    } catch (error) { res.status(500).json({ error: "Erro interno" }); }
});

app.post("/api/auth/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
});

app.get("/api/auth/me", verifyToken, (req, res) => {
    res.json({ user: req.user });
});

// Admin endpoints
app.post("/api/users/:id/approve", verifyAdmin, async (req, res, next) => {
    try {
        const result = await pool.query("UPDATE app_users SET active = true, approved_by = $1 WHERE id = $2 RETURNING id", [req.user.id, req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado" });
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (err) { next(err); }
});

app.post("/api/users", verifyAdmin, async (req, res, next) => {
    try {
        const { name, role, pin } = req.body;
        const hashedPin = await bcrypt.hash(String(pin), 12);
        await pool.query('INSERT INTO app_users (name, role, pin_code, active) VALUES ($1, $2, $3, true)', [name, role, hashedPin]);
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/auth/register", async (req, res, next) => {
    try {
        const { name, pin } = req.body;
        const role = "tecnico";
        const hashedPin = await bcrypt.hash(String(pin), 12);
        await pool.query('INSERT INTO app_users (name, role, pin_code, active) VALUES ($1, $2, $3, false)', [name, role, hashedPin]);
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/supplies", verifyAdmin, async (req, res, next) => {
    try {
        const { code, name, category, qty, min, supplier, note } = req.body;
        const inserted = await pool.query(
            'INSERT INTO supplies (code, name, category, current_quantity, minimum_quantity, supplier, note) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
            [code, name, category, Number(qty || 0), Number(min || 0), supplier || null, note || null]
        );
        await pool.query(
            'INSERT INTO stock_movements (supply_id, movement_type, quantity, quantity_before, quantity_after, user_id, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [inserted.rows[0].id, 'replenishment', 0, 0, 0, req.user.id, "Cadastro inicial"]
        );
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.put("/api/supplies/:code", verifyAdmin, async (req, res, next) => {
    try {
        const { code } = req.params;
        const { name, category, qty, min, supplier, note } = req.body;
        await pool.query(
            'UPDATE supplies SET name = $1, category = $2, current_quantity = $3, minimum_quantity = $4, supplier = $5, note = $6 WHERE code = $7',
            [name, category, Number(qty || 0), Number(min || 0), supplier || null, note || null, code]
        );
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) { next(error); }
});

// Operations
app.post("/api/movements/withdraw", verifyToken, async (req, res, next) => {
    try {
        const { code, destination, quantity } = req.body;
        const validQuantity = validatePositiveInteger(quantity);
        if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
        
        const supplyRes = await pool.query('SELECT id FROM supplies WHERE code = $1', [code]);
        if (supplyRes.rows.length === 0) return res.status(400).json({ error: "Insumo não encontrado." });
        
        let destId = null;
        if (destination) {
            const destRes = await pool.query('SELECT id FROM destinations WHERE name = $1', [destination]);
            if (destRes.rows.length > 0) destId = destRes.rows[0].id;
        }

        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, destination_id, quantity, status) VALUES ($1, $2, $3, $4, $5)',
            [supplyRes.rows[0].id, req.user.id, destId, validQuantity, 'pending']
        );

        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/requests/:id/approve", verifyAdmin, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const requestRes = await client.query(
            "UPDATE stock_requests SET status = 'approved', approved_at = now(), approved_by = $2 WHERE id = $1 AND status = 'pending' RETURNING supply_id, quantity, user_id, destination_id, note",
            [id, req.user.id]
        );
        
        if (requestRes.rows.length > 0) {
            const reqData = requestRes.rows[0];
            const supplyRes = await client.query('SELECT current_quantity FROM supplies WHERE id = $1 FOR UPDATE', [reqData.supply_id]);
            
            if (supplyRes.rows.length > 0) {
                const qBefore = supplyRes.rows[0].current_quantity;
                const qAfter = qBefore - reqData.quantity;
                
                await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, reqData.supply_id]);
                await client.query(
                    'INSERT INTO stock_movements (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                    [reqData.supply_id, reqData.user_id, reqData.destination_id, 'withdrawal', reqData.quantity, qBefore, qAfter, reqData.note]
                );
            }
        }
        await client.query('COMMIT');
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

app.delete("/api/requests/:id/cancel", verifyToken, async (req, res, next) => {
    try {
        await pool.query("DELETE FROM stock_requests WHERE id = $1 AND status = 'pending' AND user_id = $2", [req.params.id, req.user.id]);
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/movements/return", verifyToken, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code, quantity } = req.body;
        const validQuantity = validatePositiveInteger(quantity);
        if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
        const userId = req.user.id;
        
        const supplyRes = await client.query('SELECT id, current_quantity FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) throw new Error("Insumo não encontrado.");

        if (userId) {
            const heldRes = await client.query(`
                SELECT 
                  COALESCE(SUM(CASE WHEN movement_type = 'withdrawal' THEN quantity ELSE 0 END), 0) -
                  COALESCE(SUM(CASE WHEN movement_type = 'return' THEN quantity ELSE 0 END), 0) as items_held
                FROM stock_movements WHERE user_id = $1 AND supply_id = $2
            `, [userId, supplyRes.rows[0].id]);
            
            const itemsHeld = Number(heldRes.rows[0].items_held) || 0;
            if (itemsHeld < (validQuantity)) {
                throw new Error(`Você possui apenas ${itemsHeld} unidade(s) deste item para devolver.`);
            }
        }

        const qBefore = supplyRes.rows[0].current_quantity;
        const qAfter = qBefore + (validQuantity);

        await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, supplyRes.rows[0].id]);
        await client.query(
            'INSERT INTO stock_movements (supply_id, user_id, movement_type, quantity, quantity_before, quantity_after) VALUES ($1, $2, $3, $4, $5, $6)',
            [supplyRes.rows[0].id, userId, 'return', validQuantity, qBefore, qAfter]
        );
        
        await client.query('COMMIT');
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post("/api/movements/replenish", verifyAdmin, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code, quantity } = req.body;
        const validQuantity = validatePositiveInteger(quantity);
        if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
        
        const supplyRes = await client.query('SELECT id, current_quantity FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) throw new Error("Insumo não encontrado.");
        
        const qBefore = supplyRes.rows[0].current_quantity;
        const qAfter = qBefore + (validQuantity);

        await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, supplyRes.rows[0].id]);
        await client.query(
            'INSERT INTO stock_movements (supply_id, movement_type, quantity, quantity_before, quantity_after, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
            [supplyRes.rows[0].id, 'replenishment', validQuantity, qBefore, qAfter, req.user.id]
        );
        
        await client.query('COMMIT');
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post("/api/movements/adjust", verifyAdmin, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code, physicalQty } = req.body;
        
        const qAfter = validateNonNegativeInteger(physicalQty);
        if (qAfter === null) {
            return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior ou igual a zero." });
        }
        
        const supplyRes = await client.query('SELECT id, current_quantity FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) throw new Error("Insumo não encontrado.");
        
        const qBefore = supplyRes.rows[0].current_quantity;
        const diff = qAfter - qBefore;

        if (diff !== 0) {
            await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, supplyRes.rows[0].id]);
            await client.query(
                'INSERT INTO stock_movements (supply_id, movement_type, quantity, quantity_before, quantity_after, user_id) VALUES ($1, $2, $3, $4, $5, $6)',
                [supplyRes.rows[0].id, 'adjustment', Math.abs(diff), qBefore, qAfter, req.user.id]
            );
        }
        
        await client.query('COMMIT');
        broadcastState(await fetchState());
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.get("/api/events", verifyToken, (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });
    res.write("\n");
    liveClients.add(res);
    req.on("close", () => { liveClients.delete(res); });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "index.html"));
});

app.use((err, req, res, next) => {
    console.error("❌ Erro capturado pelo middleware:", err);
    console.error(err);
        res.status(500).json({ error: "Erro interno do servidor." });
});

app.listen(port, host, () => {
    console.log(`✅ Servidor seguro ativo na porta ${port}`);
});
