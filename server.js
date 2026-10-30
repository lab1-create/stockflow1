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

function normalizeSector(s) {
    return String(s || "").trim().toLowerCase() === "faturamento" ? "faturamento" : "tecnica";
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
});

const INITIAL_FATURAMENTO_ITEMS = [
    { code: 'FAT-001', name: 'Carregador Outlet - Micro USB', category: 'Carregadores', unit: 'un', min: 20, init: 0 },
    { code: 'FAT-002', name: 'Termo de garantia - 6 meses', category: 'Documentos', unit: 'un', min: 200, init: 0 },
    { code: 'FAT-003', name: 'Termo de garantia - 3 meses', category: 'Documentos', unit: 'un', min: 300, init: 0 },
    { code: 'FAT-004', name: 'Caixa para envio', category: 'Embalagem', unit: 'un', min: 100, init: 0 },
    { code: 'FAT-005', name: 'Fita gomada', category: 'Embalagem', unit: 'rolo', min: 5, init: 0 },
    { code: 'FAT-006', name: 'Fita transparente', category: 'Embalagem', unit: 'rolo', min: 3, init: 0 },
    { code: 'FAT-007', name: 'Caixinha Outlet', category: 'Embalagem', unit: 'un', min: 300, init: 0 },
    { code: 'FAT-008', name: 'Sacola Outlet', category: 'Embalagem', unit: 'un', min: 300, init: 0 },
    { code: 'FAT-009', name: 'Selo Outlet', category: 'Embalagem', unit: 'milheiro', min: 2, init: 0 },
    { code: 'FAT-010', name: 'Canguru declaração de conteúdo', category: 'Embalagem', unit: 'un', min: 100, init: 0 },
    { code: 'FAT-011', name: 'Lacre para malotes', category: 'Embalagem', unit: 'un', min: 200, init: 0 },
    { code: 'FAT-012', name: 'Chavinha de gaveta de chip (ejetor SIM)', category: 'Ferramentas', unit: 'un', min: 500, init: 0 },
    { code: 'FAT-013', name: 'Etiqueta térmica 100x150', category: 'Impressão', unit: 'rolo', min: 5, init: 0 },
    { code: 'FAT-014', name: 'Ribbon 110x91', category: 'Impressão', unit: 'rolo', min: 5, init: 0 }
];

let schemaInitialized = false;
async function ensureSchema() {
    if (schemaInitialized) return;
    try {
        await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'tecnica';");
        await pool.query("ALTER TABLE app_users ADD COLUMN IF NOT EXISTS pending_pin_code TEXT;");
        await pool.query("ALTER TABLE supplies ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'tecnica';");
        await pool.query("ALTER TABLE supplies ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'un';");
        await pool.query("ALTER TABLE supplies ADD COLUMN IF NOT EXISTS initial_quantity INTEGER NOT NULL DEFAULT 0;");
        await pool.query("ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'tecnica';");
        await pool.query("ALTER TABLE stock_requests ADD COLUMN IF NOT EXISTS sector TEXT NOT NULL DEFAULT 'tecnica';");
        await pool.query("INSERT INTO destinations (name, active) SELECT 'Faturamento', true WHERE NOT EXISTS (SELECT 1 FROM destinations WHERE LOWER(name) = 'faturamento');");

        for (const item of INITIAL_FATURAMENTO_ITEMS) {
            await pool.query(
                `INSERT INTO supplies (code, name, category, unit, minimum_quantity, initial_quantity, current_quantity, sector)
                 SELECT $1::text, $2::text, $3::text, $4::text, $5::int, $6::int, $6::int, 'faturamento'
                 WHERE NOT EXISTS (
                     SELECT 1 FROM supplies WHERE LOWER(code) = LOWER($1::text) OR LOWER(name) = LOWER($2::text)
                 )`,
                [item.code, item.name, item.category, item.unit, item.min, item.init]
            );
        }

        schemaInitialized = true;
        logger.info("✅ Schema e catálogo do Faturamento verificados com sucesso.");
    } catch (err) {
        logger.error({ err: err.message }, "⚠️ Erro ao verificar schema:");
    }
}

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
// Servir arquivos estáticos apenas se não for produção ou se a pasta Public existir localmente
if (process.env.NODE_ENV !== "production") {
    app.use(express.static(path.join(__dirname, 'Public')));
}

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
        const userCheck = await pool.query('SELECT active, role, sector FROM app_users WHERE id = $1', [verified.id]);
        if (userCheck.rows.length === 0 || !userCheck.rows[0].active) {
            return res.status(401).json({ error: "Usuário desativado ou removido." });
        }
        verified.role = userCheck.rows[0].role; // refresh role from DB
        verified.sector = normalizeSector(userCheck.rows[0].sector);
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

function verifyControlAccess(req, res, next) {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin' && req.user.sector !== 'faturamento') {
            return res.status(403).json({ error: "Acesso restrito a administradores ou controle do faturamento." });
        }
        next();
    });
}

// Buscar estado consolidado (PARALELIZADO PARA PERFORMANCE EXTREMA)
async function fetchState(page = 0, limit = 300) {
    try {
        await ensureSchema();
        const offset = page * limit;

        const [usersResult, destinationsResult, suppliesResult, movResult, reqResult] = await Promise.all([
            pool.query('SELECT id, name, role, sector, active, pending_pin_code FROM app_users ORDER BY name ASC LIMIT $1 OFFSET $2', [limit, offset]),
            pool.query('SELECT id, name FROM destinations WHERE active = true LIMIT $1 OFFSET $2', [limit, offset]),
            pool.query(`
                SELECT s.id, s.code, s.name, s.category, s.sector, s.unit, s.initial_quantity,
                       s.supplier, s.note, s.minimum_quantity, s.current_quantity, s.link, s.unit_price, s.is_shared,
                       COALESCE(agg.entries_total, 0)::int AS entries_total,
                       COALESCE(agg.exits_total, 0)::int AS exits_total,
                       agg.last_movement_at
                FROM supplies s
                LEFT JOIN (
                    SELECT supply_id,
                           SUM(CASE WHEN movement_type IN ('replenishment', 'return') AND COALESCE(note, '') != 'Cadastro inicial' THEN quantity ELSE 0 END) AS entries_total,
                           SUM(CASE WHEN movement_type = 'withdrawal' THEN quantity ELSE 0 END) AS exits_total,
                           MAX(created_at) AS last_movement_at
                    FROM stock_movements
                    GROUP BY supply_id
                ) agg ON agg.supply_id = s.id
                ORDER BY s.code ASC LIMIT $1 OFFSET $2
            `, [limit, offset]),
            pool.query(`
                SELECT sm.id, sm.supply_id, sm.user_id, sm.destination_id, sm.movement_type, 
                       sm.quantity, sm.quantity_before, sm.quantity_after, sm.note, sm.created_at,
                       COALESCE(s.sector, sm.sector, 'tecnica') as sector,
                       s.code, s.name as supply_name, u.name as user_name, d.name as dest_name
                FROM stock_movements sm
                LEFT JOIN supplies s ON sm.supply_id = s.id
                LEFT JOIN app_users u ON sm.user_id = u.id
                LEFT JOIN destinations d ON sm.destination_id = d.id
                ORDER BY sm.created_at DESC LIMIT $1 OFFSET $2
            `, [limit, offset]),
            pool.query(`
                SELECT sr.id, sr.supply_id, sr.user_id, sr.destination_id, sr.quantity, sr.status, sr.note, sr.requested_at,
                       COALESCE(s.sector, sr.sector, 'tecnica') as sector,
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
        const limit = parseInt(req.query.limit) || 300;
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

        const result = await pool.query('SELECT id, name, role, sector, pin_code, active FROM app_users WHERE LOWER(name) = LOWER($1)', [name]);
        if (result.rows.length === 0) return res.status(401).json({ error: "Usuário não encontrado no banco de dados." });

        const user = result.rows[0];
        if (!user.active) return res.status(403).json({ error: "Seu acesso ainda não foi aprovado pelo administrador." });
        
        const validPin = await bcrypt.compare(String(pin), user.pin_code);
        if (!validPin) return res.status(401).json({ error: "Senha / PIN incorreto." });

        const userSector = normalizeSector(user.sector);
        const token = jwt.sign({ id: user.id, name: user.name, role: user.role, sector: userSector }, JWT_SECRET, { expiresIn: "8h" });
        res.cookie("token", token, { httpOnly: true, secure: true, sameSite: "none" });
        
        res.json({ user: { id: user.id, name: user.name, role: user.role, sector: userSector }, token });
    } catch (error) { 
        console.error("❌ ERRO CRÍTICO NO LOGIN:", error);
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
        const userRes = await pool.query("SELECT pending_pin_code FROM app_users WHERE id = $1", [req.params.id]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: "Usuário não encontrado" });
        
        const user = userRes.rows[0];
        if (user.pending_pin_code) {
            await pool.query(
                "UPDATE app_users SET pin_code = pending_pin_code, pending_pin_code = NULL, active = true, approved_by = $1 WHERE id = $2",
                [req.user.id, req.params.id]
            );
        } else {
            await pool.query(
                "UPDATE app_users SET active = true, approved_by = $1 WHERE id = $2",
                [req.user.id, req.params.id]
            );
        }
        broadcastUpdate('USER_APPROVED', { userId: req.params.id });
        res.json({ success: true });
    } catch (err) { next(err); }
});

app.post("/api/users", verifyAdmin, async (req, res, next) => {
    try {
        const { name, role, sector } = req.body;
        const pin = req.body.pin || req.body.pin_code;
        const validName = validateString(name, 100);
        if (!validName || typeof pin !== "string" || pin.trim().length < 3) {
            return res.status(400).json({ error: "Nome (máx 100 caracteres) e Senha/PIN válidos são obrigatórios (mínimo 3 caracteres)." });
        }
        if (role !== "admin" && role !== "tecnico") {
            return res.status(400).json({ error: "Cargo inválido." });
        }
        const validSector = normalizeSector(sector);
        const hashedPin = await bcrypt.hash(String(pin), 10);
        await pool.query('INSERT INTO app_users (name, role, sector, pin_code, active) VALUES ($1, $2, $3, $4, true)', [validName, role, validSector, hashedPin]);
        broadcastUpdate('USER_CREATED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/auth/register", registerLimiter, async (req, res, next) => {
    try {
        const { name, pin, sector } = req.body;
        const validName = validateString(name, 100);
        if (!validName || typeof pin !== "string" || pin.trim().length < 3) {
            return res.status(400).json({ error: "Nome e Senha/PIN válidos são obrigatórios (mínimo 3 caracteres)." });
        }
        const role = "tecnico";
        const validSector = sector === "faturamento" ? "faturamento" : "tecnica";
        const hashedPin = await bcrypt.hash(String(pin), 10);
        // Sanitizar notas antes de gravar (XSS protection)
        const sanitizedName = escapeHTML(validName);
        await pool.query('INSERT INTO app_users (name, role, sector, pin_code, active) VALUES ($1, $2, $3, $4, false)', [sanitizedName, role, validSector, hashedPin]);
        broadcastUpdate('USER_REGISTERED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/auth/reset-password-request", registerLimiter, async (req, res, next) => {
    try {
        const { name, pin } = req.body;
        const validName = validateString(name, 100);
        if (!validName || typeof pin !== "string" || pin.trim().length < 3) {
            return res.status(400).json({ error: "Nome e Senha/PIN válidos são obrigatórios (mínimo 3 caracteres)." });
        }
        
        const userRes = await pool.query('SELECT id FROM app_users WHERE LOWER(name) = LOWER($1)', [validName]);
        if (userRes.rows.length === 0) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }
        
        const hashedPin = await bcrypt.hash(String(pin), 10);
        await pool.query('UPDATE app_users SET pending_pin_code = $1 WHERE id = $2', [hashedPin, userRes.rows[0].id]);
        
        broadcastUpdate('USER_RESET_REQUESTED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/supplies", verifyControlAccess, async (req, res, next) => {
    try {
        const { code, name, category, qty, min, supplier, note, link, unit_price, is_shared, sector, unit, initial_quantity } = req.body;
        const initQty = initial_quantity !== undefined ? validateNonNegativeInteger(initial_quantity) : validateNonNegativeInteger(qty ?? 0);
        const validQty = qty !== undefined ? validateNonNegativeInteger(qty) : initQty;
        const validMin = validateNonNegativeInteger(min ?? 0);
        const validCode = validateString(code, 50);
        const validName = validateString(name, 150);
        const validUnit = validateString(unit, 30) || 'un';
        const validSector = req.user.role !== 'admin' ? 'faturamento' : (sector === 'faturamento' ? 'faturamento' : 'tecnica');
        
        if (validQty === null || validMin === null || !validCode || !validName) {
            return res.status(400).json({ error: "Dados inválidos para o insumo." });
        }

        // Verificar se já existe um insumo com este mesmo código
        const checkExisting = await pool.query('SELECT id FROM supplies WHERE LOWER(code) = LOWER($1)', [validCode]);
        if (checkExisting.rows.length > 0) {
            return res.status(400).json({ error: `O código de insumo '${validCode}' já está cadastrado no sistema.` });
        }
        
        const inserted = await pool.query(
            'INSERT INTO supplies (code, name, category, unit, initial_quantity, current_quantity, minimum_quantity, supplier, note, link, unit_price, is_shared, sector) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id',
            [
                validCode, 
                validName, 
                validateString(category, 50) || 'Geral',
                validUnit,
                initQty ?? 0,
                validQty, 
                validMin, 
                validateString(supplier, 100), 
                validateString(note, 255),
                validateString(link, 255),
                Number(unit_price) || 0,
                Boolean(is_shared),
                validSector
            ]
        );
        if (validQty > 0) {
            await pool.query(
                'INSERT INTO stock_movements (supply_id, movement_type, quantity, quantity_before, quantity_after, user_id, note, sector) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [inserted.rows[0].id, 'replenishment', validQty, 0, validQty, req.user.id, "Cadastro inicial", validSector]
            );
        }
        
        // Auto-link pending stock_requests that match the name or code
        const newSupplyId = inserted.rows[0].id;
        await pool.query(
            `UPDATE stock_requests 
             SET supply_id = $1 
             WHERE supply_id IS NULL 
               AND (
                 LOWER(note) LIKE LOWER($2) 
                 OR LOWER(note) LIKE LOWER($3)
                 OR LOWER(note) LIKE LOWER($4)
                 OR LOWER(note) LIKE LOWER($5)
               )`,
            [newSupplyId, `%[SOLICITAÇÃO DE INSUMO: ${validName}]%`, `%[SOLICITAÇÃO DE INSUMO NÃO CADASTRADO: ${validName}]%`, `%${validName}%`, `%${validCode}%`]
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

app.put("/api/supplies/:code", verifyControlAccess, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code } = req.params;
        const { name, category, qty, min, supplier, note, link, unit_price, is_shared, sector, unit, initial_quantity } = req.body;
        
        const validMin = validateNonNegativeInteger(min);
        const validName = validateString(name, 150);
        const validSector = sector === 'faturamento' ? 'faturamento' : (sector === 'tecnica' ? 'tecnica' : null);
        
        if (validMin === null || !validName) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Dados inválidos." });
        }

        const supplyRes = await client.query('SELECT id, current_quantity, initial_quantity, unit, sector FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Insumo não encontrado." });
        }
        
        const qBefore = supplyRes.rows[0].current_quantity;
        const initBefore = supplyRes.rows[0].initial_quantity || 0;
        const supplyId = supplyRes.rows[0].id;
        const targetSector = validSector || supplyRes.rows[0].sector || 'tecnica';
        const targetUnit = validateString(unit, 30) || supplyRes.rows[0].unit || 'un';
        const targetInit = initial_quantity !== undefined && validateNonNegativeInteger(initial_quantity) !== null
            ? validateNonNegativeInteger(initial_quantity)
            : initBefore;

        let validQty = qty !== undefined ? validateNonNegativeInteger(qty) : null;
        if (validQty === null) {
            validQty = Math.max(0, qBefore + (targetInit - initBefore));
        } else if (initial_quantity !== undefined && targetInit !== initBefore && validQty === qBefore) {
            validQty = Math.max(0, qBefore + (targetInit - initBefore));
        }

        await client.query(
            'UPDATE supplies SET name = $1, category = $2, unit = $3, initial_quantity = $4, current_quantity = $5, minimum_quantity = $6, supplier = $7, note = $8, link = $9, unit_price = $10, is_shared = $11, sector = $12 WHERE id = $13',
            [
                validName, 
                validateString(category, 50) || 'Geral',
                targetUnit,
                targetInit,
                validQty, 
                validMin, 
                validateString(supplier, 100), 
                validateString(note, 255),
                validateString(link, 255),
                Number(unit_price) || 0,
                Boolean(is_shared),
                targetSector,
                supplyId
            ]
        );

        if (qBefore !== validQty) {
            const diff = validQty - qBefore;
            await client.query(
                'INSERT INTO stock_movements (supply_id, user_id, movement_type, quantity, quantity_before, quantity_after, note, sector) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [supplyId, req.user.id, 'adjustment', Math.abs(diff), qBefore, validQty, targetInit !== initBefore ? "Ajuste de Estoque Inicial" : "Edição de referência", targetSector]
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

app.patch("/api/faturamento/supplies/:code/cells", verifyControlAccess, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code } = req.params;
        const { minimum_quantity, initial_quantity } = req.body;

        const supplyRes = await client.query('SELECT id, current_quantity, minimum_quantity, initial_quantity, sector FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Item não encontrado." });
        }

        const item = supplyRes.rows[0];
        const newMin = minimum_quantity !== undefined ? validateNonNegativeInteger(minimum_quantity) : item.minimum_quantity;
        const newInit = initial_quantity !== undefined ? validateNonNegativeInteger(initial_quantity) : (item.initial_quantity || 0);

        if (newMin === null || newInit === null) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Valores devem ser números inteiros maiores ou iguais a zero." });
        }

        const initDiff = newInit - (item.initial_quantity || 0);
        const qBefore = item.current_quantity || 0;
        const qAfter = Math.max(0, qBefore + initDiff);

        await client.query(
            'UPDATE supplies SET minimum_quantity = $1, initial_quantity = $2, current_quantity = $3 WHERE id = $4',
            [newMin, newInit, qAfter, item.id]
        );

        if (initDiff !== 0) {
            await client.query(
                'INSERT INTO stock_movements (supply_id, user_id, movement_type, quantity, quantity_before, quantity_after, note, sector) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [item.id, req.user.id, 'adjustment', Math.abs(initDiff), qBefore, qAfter, `Estoque Inicial ajustado (${item.initial_quantity || 0} → ${newInit})`, item.sector || 'faturamento']
            );
        }

        await client.query('COMMIT');
        broadcastUpdate('SUPPLY_UPDATED', { supplyCode: code });
        res.json({ success: true, current_quantity: qAfter, minimum_quantity: newMin, initial_quantity: newInit });
    } catch (error) {
        await client.query('ROLLBACK');
        next(error);
    } finally {
        client.release();
    }
});

app.post("/api/faturamento/movement", verifyControlAccess, async (req, res, next) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { code, type, quantity, responsible, note } = req.body;
        const validQuantity = validatePositiveInteger(quantity);
        if (!validQuantity) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Quantidade inválida. Informe um número inteiro maior que zero." });
        }
        if (type !== 'in' && type !== 'out') {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Tipo de movimentação inválido. Escolha Entrada ou Saída." });
        }

        const supplyRes = await client.query(
            'SELECT id, code, name, current_quantity, sector FROM supplies WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1) FOR UPDATE',
            [String(code || '').trim()]
        );
        if (supplyRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Insumo não encontrado no catálogo do Faturamento." });
        }

        const supply = supplyRes.rows[0];
        const qBefore = supply.current_quantity || 0;
        const qAfter = type === 'in' ? (qBefore + validQuantity) : (qBefore - validQuantity);

        if (qAfter < 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Saldo insuficiente! Estoque atual de "${supply.name}" é ${qBefore}.` });
        }

        let targetUserId = req.user.id;
        const respTrimmed = validateString(responsible, 100);
        if (respTrimmed) {
            const uRes = await client.query('SELECT id FROM app_users WHERE LOWER(name) = LOWER($1)', [respTrimmed]);
            if (uRes.rows.length > 0) {
                targetUserId = uRes.rows[0].id;
            }
        }

        const destRes = await client.query("SELECT id FROM destinations WHERE LOWER(name) = 'faturamento' LIMIT 1");
        const destId = destRes.rows.length > 0 ? destRes.rows[0].id : null;

        await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, supply.id]);

        const movType = type === 'in' ? 'replenishment' : 'withdrawal';
        const cleanNote = validateString(note, 200) || '';
        const finalNote = respTrimmed && respTrimmed.toLowerCase() !== String(req.user.name || '').toLowerCase()
            ? `Para: ${respTrimmed}${cleanNote ? ' - ' + cleanNote : ''}`
            : (cleanNote || (type === 'in' ? 'Entrada de estoque (Faturamento)' : 'Saída de estoque (Faturamento)'));

        await client.query(
            'INSERT INTO stock_movements (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after, note, sector) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [supply.id, targetUserId, destId, movType, validQuantity, qBefore, qAfter, finalNote, supply.sector || 'faturamento']
        );

        await client.query('COMMIT');
        broadcastUpdate('FATURAMENTO_MOVEMENT', { supplyCode: supply.code });
        res.json({ success: true, current_quantity: qAfter });
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
        const { itemName, quantity, note, sector } = req.body;
        const validName = validateString(itemName, 150);
        const validQuantity = validatePositiveInteger(quantity) || 1;
        
        if (!validName) return res.status(400).json({ error: "Nome do insumo solicitado é obrigatório." });

        const supplyRes = await pool.query('SELECT id, sector FROM supplies WHERE LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1)', [validName]);
        const supplyId = supplyRes.rows.length > 0 ? supplyRes.rows[0].id : null;
        const itemSector = sector === 'faturamento' ? 'faturamento' : (supplyRes.rows.length > 0 && supplyRes.rows[0].sector ? supplyRes.rows[0].sector : (req.user.sector === 'faturamento' ? 'faturamento' : 'tecnica'));

        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, quantity, status, note, sector) VALUES ($1, $2, $3, $4, $5, $6)',
            [supplyId, req.user.id, validQuantity, 'pending', `[SOLICITAÇÃO DE INSUMO: ${validName}] ${note || ''}`, itemSector]
        );

        broadcastUpdate('CUSTOM_REQUEST_CREATED');
        res.json({ success: true });
    } catch (error) { next(error); }
});

app.post("/api/requests/custom", verifyToken, async (req, res, next) => {
    try {
        const { itemName, quantity, note, sector } = req.body;
        const validName = validateString(itemName, 150);
        const validQuantity = validatePositiveInteger(quantity) || 1;
        
        if (!validName) return res.status(400).json({ error: "Nome do insumo solicitado é obrigatório." });

        const supplyRes = await pool.query('SELECT id, sector FROM supplies WHERE LOWER(name) = LOWER($1) OR LOWER(code) = LOWER($1)', [validName]);
        const supplyId = supplyRes.rows.length > 0 ? supplyRes.rows[0].id : null;
        const itemSector = sector === 'faturamento' ? 'faturamento' : (supplyRes.rows.length > 0 && supplyRes.rows[0].sector ? supplyRes.rows[0].sector : (req.user.sector === 'faturamento' ? 'faturamento' : 'tecnica'));

        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, quantity, status, note, sector) VALUES ($1, $2, $3, $4, $5, $6)',
            [supplyId, req.user.id, validQuantity, 'pending', `[SOLICITAÇÃO DE INSUMO: ${validName}] ${note || ''}`, itemSector]
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
        const { code, destination, quantity, note, technician, sector } = req.body;
        const validQuantity = validatePositiveInteger(quantity);
        if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
        
        const supplyRes = await pool.query('SELECT id, sector FROM supplies WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1)', [code]);
        const supplyId = supplyRes.rows.length > 0 ? supplyRes.rows[0].id : null;
        
        let destId = null;
        if (destination) {
            const destRes = await pool.query('SELECT id FROM destinations WHERE name = $1', [destination]);
            if (destRes.rows.length > 0) destId = destRes.rows[0].id;
        }

        let targetUserId = req.user.id;
        if (technician) {
            const techRes = await pool.query('SELECT id FROM app_users WHERE LOWER(name) = LOWER($1)', [technician.trim()]);
            if (techRes.rows.length > 0) {
                targetUserId = techRes.rows[0].id;
            }
        }

        let itemSector = 'tecnica';
        if (supplyRes.rows.length > 0 && supplyRes.rows[0].sector) {
            itemSector = supplyRes.rows[0].sector;
        } else if (sector === 'faturamento') {
            itemSector = 'faturamento';
        } else if (req.user.sector === 'faturamento') {
            itemSector = 'faturamento';
        }

        const finalNote = supplyId ? validateString(note, 255) : `[SOLICITAÇÃO DE INSUMO NÃO CADASTRADO: ${code}] ${note || ''}`;

        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, destination_id, quantity, status, note, sector) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [supplyId, targetUserId, destId, validQuantity, 'pending', finalNote, itemSector]
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
            "SELECT sr.supply_id, sr.quantity, sr.user_id, sr.destination_id, sr.note, sr.sector, s.sector as supply_sector FROM stock_requests sr LEFT JOIN supplies s ON sr.supply_id = s.id WHERE sr.id = $1 AND sr.status = 'pending'",
            [id]
        );
        
        if (requestRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: "Requisição não encontrada ou já processada." });
        }
        
        const reqData = requestRes.rows[0];
        if (!reqData.supply_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "Este insumo não está cadastrado no catálogo. Por favor, cadastre-o antes de aprovar." });
        }

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
        
        const itemSector = reqData.sector || reqData.supply_sector || 'tecnica';

        await client.query(
            'INSERT INTO stock_movements (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after, note, sector) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
            [reqData.supply_id, reqData.user_id, reqData.destination_id, 'withdrawal', reqData.quantity, qBefore, qAfter, reqData.note, itemSector]
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
        if (req.user.role === 'admin') {
            await pool.query("DELETE FROM stock_requests WHERE id = $1 AND status = 'pending'", [req.params.id]);
        } else {
            await pool.query("DELETE FROM stock_requests WHERE id = $1 AND status = 'pending' AND user_id = $2", [req.params.id, req.user.id]);
        }
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
        
        const supplyRes = await client.query('SELECT id, current_quantity, sector FROM supplies WHERE LOWER(code) = LOWER($1) OR LOWER(name) = LOWER($1) FOR UPDATE', [code]);
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
        const itemSector = supplyRes.rows[0].sector || 'tecnica';

        await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, supplyRes.rows[0].id]);
        await client.query(
            'INSERT INTO stock_movements (supply_id, user_id, movement_type, quantity, quantity_before, quantity_after, sector) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [supplyRes.rows[0].id, userId, 'return', validQuantity, qBefore, qAfter, itemSector]
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

app.post("/api/movements/replenish", verifyControlAccess, async (req, res, next) => {
    const { code, quantity } = req.body;
    const validQuantity = validatePositiveInteger(quantity);
    if (!validQuantity) return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior que zero." });
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const supplyRes = await client.query('SELECT id, current_quantity, sector FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) throw new Error("Insumo não encontrado.");
        
        const qBefore = supplyRes.rows[0].current_quantity;
        const qAfter = qBefore + (validQuantity);
        const itemSector = supplyRes.rows[0].sector || 'tecnica';

        await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, supplyRes.rows[0].id]);
        await client.query(
            'INSERT INTO stock_movements (supply_id, movement_type, quantity, quantity_before, quantity_after, user_id, sector) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [supplyRes.rows[0].id, 'replenishment', validQuantity, qBefore, qAfter, req.user.id, itemSector]
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

app.post("/api/movements/adjust", verifyControlAccess, async (req, res, next) => {
    const { code, physicalQty } = req.body;
    const qAfter = validateNonNegativeInteger(physicalQty);
    if (qAfter === null) {
        return res.status(400).json({ error: "Quantidade inválida. Deve ser um número inteiro maior ou igual a zero." });
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const supplyRes = await client.query('SELECT id, current_quantity, sector FROM supplies WHERE code = $1 FOR UPDATE', [code]);
        if (supplyRes.rows.length === 0) throw new Error("Insumo não encontrado.");
        
        const qBefore = supplyRes.rows[0].current_quantity;
        const diff = qAfter - qBefore;
        const itemSector = supplyRes.rows[0].sector || 'tecnica';

        if (diff !== 0) {
            await client.query('UPDATE supplies SET current_quantity = $1 WHERE id = $2', [qAfter, supplyRes.rows[0].id]);
            await client.query(
                'INSERT INTO stock_movements (supply_id, movement_type, quantity, quantity_before, quantity_after, user_id, sector) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [supplyRes.rows[0].id, 'adjustment', Math.abs(diff), qBefore, qAfter, req.user.id, itemSector]
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
});

app.all("*", (req, res) => {
    res.status(404).json({ error: `Rota '${req.originalUrl}' não encontrada.` });
});

app.use((err, req, res, next) => {
    console.error("❌ Erro capturado pelo middleware:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
});

if (process.env.NODE_ENV !== "test") {
    ensureSchema().finally(() => {
        app.listen(port, host, () => {
            logger.info(`Servidor rodando em http://${host}:${port}`);
        });
    });
}

exports.api = onRequest({ secrets: ["DATABASE_URL", "JWT_SECRET"], region: "us-central1" }, app);
