const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
require("dotenv").config();
const path = require("path");
const pino = require('pino');
const logger = pino({ level: process.env.NODE_ENV === 'production' ? 'info' : 'debug' });
const express = require("express");
const { onRequest } = require("firebase-functions/v2/https");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
app.set('trust proxy', 1);
const port = Number(process.env.PORT || 4173);
const host = "0.0.0.0";


// ----- Env validation -------------------------------------------------------
if (!process.env.JWT_SECRET) {
    throw new Error("FATAL: JWT_SECRET não configurado no ambiente.");
}
if (!process.env.DATABASE_URL) {
    throw new Error("FATAL: DATABASE_URL não configurado no ambiente.");
}
// Opcional: validar FRONTEND_URL em produção
if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    throw new Error("FATAL: FRONTEND_URL é obrigatório em produção.");
}
const JWT_SECRET = process.env.JWT_SECRET;

let connectionString = process.env.DATABASE_URL;
if (connectionString) {
    // Remover sslmode query param manual se existir para deixar o objeto pg.ssl cuidar disso
    connectionString = connectionString.replace(/[?&]sslmode=[^&]*/, '');
}

// Validation Helpers
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

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function validateString(value, maxLength = 255) {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLength) return null;
    return trimmed;
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

if (process.env.NODE_ENV === "production" && !process.env.FRONTEND_URL) {
    throw new Error("FRONTEND_URL obrigatório em produção");
}

// ----- Security: CORS & Headers ------------------------------------------
const defaultOrigins = ["http://localhost:3000", "http://localhost:4173"];
let allowedOrigins;
if (process.env.NODE_ENV === "production") {
    // Em produção exige explicitamente FRONTEND_URL
    allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : [];
    if (allowedOrigins.length === 0) {
        throw new Error("FATAL: Nenhuma origem CORS configurada para produção.");
    }
} else {
    // Desenvolvimento permite padrão local
    allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(',') : defaultOrigins;
}
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(helmet({
    contentSecurityPolicy: true
}));
app.use(express.static(path.join(__dirname, 'Public')));

// Auth Middlewares
async function verifyToken(req, res, next) {
    let token = req.cookies.token;
    const authHeader = req.headers.authorization;
    if (!token && authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
    }
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

// Buscar estado consolidado (PARALELIZADO PARA PERFORMANCE EXTREMA)
async function fetchState(page = 0, limit = 100) {
    try {
        const offset = page * limit;

        const [usersResult, destinationsResult, suppliesResult, movResult, reqResult] = await Promise.all([
            pool.query('SELECT id, name, role, active FROM app_users ORDER BY name ASC LIMIT $1 OFFSET $2', [limit, offset]),
            pool.query('SELECT id, name FROM destinations WHERE active = true LIMIT $1 OFFSET $2', [limit, offset]),
            pool.query('SELECT id, code, name, category, supplier, note, minimum_quantity, current_quantity, link, unit_price, is_shared FROM supplies ORDER BY code ASC LIMIT $1 OFFSET $2', [limit, offset]),
            pool.query(`
                SELECT sm.id, sm.supply_id, sm.user_id, sm.destination_id, sm.movement_type, 
                       sm.quantity, sm.quantity_before, sm.quantity_after, sm.note, sm.created_at,
                       s.code, s.name as supply_name, u.name as user_name, d.name as dest_name
                FROM stock_movements sm
                LEFT JOIN supplies s ON sm.supply_id = s.id
                LEFT JOIN app_users u ON sm.user_id = u.id
                LEFT JOIN destinations d ON sm.destination_id = d.id
                ORDER BY sm.created_at DESC LIMIT $1 OFFSET $2
            `, [limit, offset]),
            pool.query(`
                SELECT sr.id, sr.supply_id, sr.user_id, sr.destination_id, sr.quantity, sr.status, sr.requested_at,
                       s.code, s.name as supply_name, u.name as user_name, d.name as dest_name
                FROM stock_requests sr
                LEFT JOIN supplies s ON sr.supply_id = s.id
                LEFT JOIN app_users u ON sr.user_id = u.id
                LEFT JOIN destinations d ON sr.destination_id = d.id
                ORDER BY sr.requested_at DESC
                LIMIT $1 OFFSET $2
            `, [limit, offset])
        ]);

        return { 
            users: usersResult.rows, 
            destinations: destinationsResult.rows.map(d => d.name), 
            supplies: suppliesResult.rows, 
            movements: movResult.rows, 
            requests: reqResult.rows,
            pagination: { page, limit, offset }
        };
    } catch (error) {
        logger.error('❌ Erro crítico ao buscar dados no Supabase:', error);
        throw error;
    }
}

// Removido SSE para evitar custos de conexão persistente com Serverless
function broadcastUpdate(action, payload = null) {
    // No-op (Será resolvido por polling no app.js)
}

// ---- ENDPOINTS DA API ----
app.get("/api/bootstrap", verifyToken, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 0;
        const limit = parseInt(req.query.limit) || 100;
        const data = await fetchState(page, limit);
        res.json(data);
    } catch (error) {
        next(error);
    }
});

// Auth endpoints
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 10, 
    message: { error: "Muitas tentativas de cadastro a partir deste IP. Tente novamente mais tarde." }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 30, 
    message: { error: "Muitas tentativas. Tente novamente em alguns minutos." }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { name, pin } = req.body;
        if (!name || !pin) return res.status(400).json({ error: "Nome e PIN obrigatórios." });

        const result = await pool.query('SELECT id, name, role, pin_code, active FROM app_users WHERE LOWER(name) = LOWER($1)', [name]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado no banco de dados." });

        const user = result.rows[0];
        if (!user.active) return res.status(403).json({ error: "Seu acesso ainda não foi aprovado pelo administrador." });
        
        const validPin = await bcrypt.compare(String(pin), user.pin_code);
        if (!validPin) return res.status(401).json({ error: "Senha / PIN incorreto." });

        const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
        res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
        
        res.json({ user: { id: user.id, name: user.name, role: user.role }, token });
    } catch (error) { 
        logger.error({ err: error.message, stack: error.stack }, 'Login error details');
        res.status(500).json({ error: error.message || "Erro interno" }); 
    }
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
        broadcastUpdate('USER_APPROVED', { userId: req.params.id });
        res.json({ success: true });
    } catch (err) { next(err); }
});

app.post("/api/users", verifyAdmin, async (req, res, next) => {
    try {
        const { name, role, pin } = req.body;
        const validName = validateString(name, 100);
        if (!validName || !/^\d{4,6}$/.test(String(pin))) {
            return res.status(400).json({ error: "Nome (máx 100 caracteres) e PIN (4-6 dígitos) válidos são obrigatórios." });
        }
        if (role !== "admin" && role !== "tecnico") {
            return res.status(400).json({ error: "Cargo inválido." });
        }
        const hashedPin = await bcrypt.hash(String(pin), 12);
        await pool.query('INSERT INTO app_users (name, role, pin_code, active) VALUES ($1, $2, $3, true)', [validName, role, hashedPin]);
        broadcastUpdate('USER_CREATED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/auth/register", registerLimiter, async (req, res, next) => {
    try {
        const { name, pin } = req.body;
        const validName = validateString(name, 100);
        if (!validName || typeof pin !== "string" || pin.trim().length < 3) {
            return res.status(400).json({ error: "Nome e Senha/PIN válidos são obrigatórios (mínimo 3 caracteres)." });
        }
        const role = "tecnico";
        const hashedPin = await bcrypt.hash(String(pin), 12);
        // Sanitizar notas antes de gravar (XSS protection)
        const sanitizedName = escapeHTML(validName);
        await pool.query('INSERT INTO app_users (name, role, pin_code, active) VALUES ($1, $2, $3, false)', [sanitizedName, role, hashedPin]);
        broadcastUpdate('USER_REGISTERED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/supplies", verifyAdmin, async (req, res, next) => {
    try {
        const { code, name, category, qty, min, supplier, note, link, unit_price, is_shared } = req.body;
        const validQty = validateNonNegativeInteger(qty);
        const validMin = validateNonNegativeInteger(min);
        const validCode = validateString(code, 50);
        const validName = validateString(name, 150);
        
        if (validQty === null || validMin === null || !validCode || !validName) {
            return res.status(400).json({ error: "Dados inválidos para o insumo." });
        }

        // Verificar se já existe um insumo com este mesmo código
        const checkExisting = await pool.query('SELECT id FROM supplies WHERE LOWER(code) = LOWER($1)', [validCode]);
        if (checkExisting.rows.length > 0) {
            return res.status(400).json({ error: `O código de insumo '${validCode}' já está cadastrado no sistema.` });
        }
        
        const inserted = await pool.query(
            'INSERT INTO supplies (code, name, category, current_quantity, minimum_quantity, supplier, note, link, unit_price, is_shared) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
            [
                validCode, 
                validName, 
                validateString(category, 50), 
                validQty, 
                validMin, 
                validateString(supplier, 100), 
                validateString(note, 255),
                validateString(link, 255),
                Number(unit_price) || 0,
                Boolean(is_shared)
            ]
        );
        await pool.query(
            'INSERT INTO stock_movements (supply_id, movement_type, quantity, quantity_before, quantity_after, user_id, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [inserted.rows[0].id, 'replenishment', validQty, 0, validQty, req.user.id, "Cadastro inicial"]
        );
        broadcastUpdate('SUPPLY_CREATED', { supplyCode: validCode });
        res.json({ success: true });
    } catch (error) { 
        if (error.code === '23505') {
            return res.status(400).json({ error: "Código de insumo já cadastrado no sistema." });
        }
        logger.error({ err: error.message, stack: error.stack }, 'Erro ao inserir insumo');
        next(error); 
    }
});

app.put("/api/supplies/:code", verifyAdmin, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code } = req.params;
        const { name, category, qty, min, supplier, note, link, unit_price, is_shared } = req.body;
        
        const validQty = validateNonNegativeInteger(qty);
        const validMin = validateNonNegativeInteger(min);
        const validName = validateString(name, 150);
        
        if (validQty === null || validMin === null || !validName) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Dados inválidos." });
        }

        const supplyRes = await client.query('SELECT id, current_quantity FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Insumo não encontrado." });
        }
        
        const qBefore = supplyRes.rows[0].current_quantity;
        const supplyId = supplyRes.rows[0].id;

        await client.query(
            'UPDATE supplies SET name = $1, category = $2, current_quantity = $3, minimum_quantity = $4, supplier = $5, note = $6, link = $7, unit_price = $8, is_shared = $9 WHERE id = $10',
            [
                validName, 
                validateString(category, 50), 
                validQty, 
                validMin, 
                validateString(supplier, 100), 
                validateString(note, 255),
                validateString(link, 255),
                Number(unit_price) || 0,
                Boolean(is_shared),
                supplyId
            ]
        );

        if (qBefore !== validQty) {
            const diff = validQty - qBefore;
            // 🚨 Fix: Aplicação do Math.abs() para quantidades no ajuste manual
            await client.query(
                'INSERT INTO stock_movements (supply_id, user_id, movement_type, quantity, quantity_before, quantity_after, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [supplyId, req.user.id, 'adjustment', Math.abs(diff), qBefore, validQty, "Edição administrativa"]
            );
        }

        await client.query('COMMIT');
        broadcastUpdate('SUPPLY_UPDATED', { supplyCode: code });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

// Operations
app.post("/api/custom-requests", verifyToken, async (req, res, next) => {
    try {
        const { itemName, quantity, note } = req.body;
        const validName = validateString(itemName, 150);
        const validQuantity = validatePositiveInteger(quantity) || 1;
        
        if (!validName) return res.status(400).json({ error: "Nome do insumo solicitado é obrigatório." });

        const supplyRes = await pool.query('SELECT id FROM supplies WHERE LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1)', [validName]);
        const supplyId = supplyRes.rows.length > 0 ? supplyRes.rows[0].id : null;

        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, quantity, status, note) VALUES ($1, $2, $3, $4, $5)',
            [supplyId, req.user.id, validQuantity, 'pending', `[SOLICITAÇÃO DE INSUMO: ${validName}] ${note || ''}`]
        );

        broadcastUpdate('CUSTOM_REQUEST_CREATED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/requests/custom", verifyToken, async (req, res, next) => {
    try {
        const { itemName, quantity, note } = req.body;
        const validName = validateString(itemName, 150);
        const validQuantity = validatePositiveInteger(quantity) || 1;
        
        if (!validName) return res.status(400).json({ error: "Nome do insumo solicitado é obrigatório." });

        const supplyRes = await pool.query('SELECT id FROM supplies WHERE LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1)', [validName]);
        const supplyId = supplyRes.rows.length > 0 ? supplyRes.rows[0].id : null;

        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, quantity, status, note) VALUES ($1, $2, $3, $4, $5)',
            [supplyId, req.user.id, validQuantity, 'pending', `[SOLICITAÇÃO DE INSUMO: ${validName}] ${note || ''}`]
        );

        broadcastUpdate('CUSTOM_REQUEST_CREATED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

const withdrawLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 20, // max 20 requests
    message: { error: "Muitas requisições. Aguarde um momento." }
});

app.post("/api/movements/withdraw", verifyToken, withdrawLimiter, async (req, res, next) => {
    try {
        const { code, destination, quantity, note } = req.body;
        const validQuantity = validatePositiveInteger(quantity);
        if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
        
        const supplyRes = await pool.query('SELECT id FROM supplies WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1)', [code]);
        const supplyId = supplyRes.rows.length > 0 ? supplyRes.rows[0].id : null;
        
        let destId = null;
        if (destination) {
            const destRes = await pool.query('SELECT id FROM destinations WHERE name = $1', [destination]);
            if (destRes.rows.length > 0) destId = destRes.rows[0].id;
        }

        const finalNote = supplyId ? validateString(note, 255) : `[SOLICITAÇÃO DE INSUMO NÃO CADASTRADO: ${code}] ${note || ''}`;

        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, destination_id, quantity, status, note) VALUES ($1, $2, $3, $4, $5, $6)',
            [supplyId, req.user.id, destId, validQuantity, 'pending', finalNote]
        );

        broadcastUpdate('WITHDRAW_REQUESTED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/requests/:id/approve", verifyAdmin, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { id } = req.params;
        const requestRes = await client.query(
            "SELECT supply_id, quantity, user_id, destination_id, note FROM stock_requests WHERE id = $1 AND status = 'pending'",
            [id]
        );
        
        if (requestRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Requisição não encontrada ou já processada." });
        }
        
        const reqData = requestRes.rows[0];
        const supplyRes = await client.query('SELECT current_quantity FROM supplies WHERE id = $1 FOR UPDATE', [reqData.supply_id]);
        
        if (supplyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Insumo não encontrado no banco." });
        }
        
        const qBefore = supplyRes.rows[0].current_quantity;
        const qAfter = qBefore - reqData.quantity;
        
        if (qAfter < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Estoque insuficiente para aprovar esta retirada." });
        }
        
        await client.query(
            "UPDATE stock_requests SET status = 'approved', approved_at = now(), approved_by = $2 WHERE id = $1",
            [id, req.user.id]
        );
        
        await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, reqData.supply_id]);
        
        await client.query(
            'INSERT INTO stock_movements (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [reqData.supply_id, reqData.user_id, reqData.destination_id, 'withdrawal', reqData.quantity, qBefore, qAfter, reqData.note]
        );
            
        await client.query('COMMIT');
        broadcastUpdate('REQUEST_APPROVED', { requestId: id });
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
        broadcastUpdate('REQUEST_CANCELLED', { requestId: req.params.id });
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/movements/return", verifyToken, async (req, res, next) => {
    const { code, quantity } = req.body;
    const validQuantity = validatePositiveInteger(quantity);
    if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const userId = req.user.id;
        
        const supplyRes = await client.query('SELECT id, current_quantity FROM supplies WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1) FOR UPDATE', [code]);
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
        broadcastUpdate('ITEM_RETURNED', { supplyCode: code });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post("/api/movements/replenish", verifyAdmin, async (req, res, next) => {
    const { code, quantity } = req.body;
    const validQuantity = validatePositiveInteger(quantity);
    if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
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
        broadcastUpdate('ITEM_REPLENISHED', { supplyCode: code });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }
});

app.post("/api/movements/adjust", verifyAdmin, async (req, res, next) => {
    const { code, physicalQty } = req.body;
    const qAfter = validateNonNegativeInteger(physicalQty);
    if (qAfter === null) {
        return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior ou igual a zero." });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
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
        broadcastUpdate('INVENTORY_ADJUSTED', { supplyCode: code });
        res.json({ success: true });
    } catch (error) {
        await client.query('ROLLBACK');
        res.status(400).json({ error: error.message });
    } finally {
        client.release();
    }



app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `Rota de API '${req.originalUrl}' não encontrada.` });
});

app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "Public", "index.html"));
});

app.use((err, req, res, next) => {
    console.error("❌ Erro capturado pelo middleware:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
});

if (process.env.NODE_ENV !== "test") {
    app.listen(port, host, () => {
        logger.info(`Servidor rodando em http://${host}:${port}`);
    });
}

exports.api = onRequest({ secrets: ["DATABASE_URL", "JWT_SECRET"], region: "us-central1" }, app);
