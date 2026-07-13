require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4173);
const host = "0.0.0.0";
const liveClients = new Set();

// CORREÇÃO CRÍTICA DO IPV6 (Supabase / Render):
// Adiciona regras explícitas para evitar o erro ENETUNREACH
let connectionString = process.env.DATABASE_URL;
if (connectionString && !connectionString.includes("sslmode=")) {
    // Força o Supabase a ignorar problemas de IPv6/Pooling se necessário
    if (connectionString.includes("supabase.pool.pooler.supabase.com")) {
        // Se estiver usando o pooler padrão
        connectionString += connectionString.includes("?") ? "&sslmode=require" : "?sslmode=require";
    }
}

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

// Configurações Globais
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORREÇÃO DA TELA BRANCA: Servir arquivos estáticos ANTES de qualquer rota de API ou do wildcard (*)
app.use(express.static(__dirname));

// Buscar estado consolidado das tabelas do Supabase
async function fetchState() {
    try {
        const usersResult = await pool.query(
            'SELECT id, name, role, pin_code FROM app_users WHERE active = true ORDER BY name ASC'
        );
        const users = usersResult.rows;

        const destResult = await pool.query(
            'SELECT id, name FROM destinations WHERE active = true'
        );
        const destinations = destResult.rows.map(d => d.name);

        const suppliesResult = await pool.query(
            'SELECT id, code, name, category, current_quantity FROM supplies ORDER BY code ASC'
        );
        const supplies = suppliesResult.rows;

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
        const movements = movResult.rows;

        const reqResult = await pool.query(`
            SELECT sr.id, sr.supply_id, sr.user_id, sr.destination_id, sr.quantity, sr.status, sr.requested_at,
                   s.code, s.name as supply_name, u.name as user_name, d.name as dest_name
            FROM stock_requests sr
            LEFT JOIN supplies s ON sr.supply_id = s.id
            LEFT JOIN app_users u ON sr.user_id = u.id
            LEFT JOIN destinations d ON sr.destination_id = d.id
            ORDER BY sr.requested_at DESC
        `);
        const requests = reqResult.rows;

        return { users, destinations, supplies, movements, requests };
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

app.get("/api/bootstrap", async (req, res, next) => {
    try {
        res.json(await fetchState());
    } catch (error) {
        next(error);
    }
});

app.post("/api/login", async (req, res) => {
    try {
        const { name, pin } = req.body;
        // CORREÇÃO 1: ILIKE em vez de = (ignora maiúsculas/minúsculas)
        const result = await pool.query(
            'SELECT id, name, role, pin_code FROM app_users WHERE name ILIKE $1 AND active = true',
            [name]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Usuário não encontrado ou inativo." });
        }

        const user = result.rows[0];
        // CORREÇÃO 2: Conversão de tipos com String()
        if (String(pin) !== String(user.pin_code)) {
            return res.status(400).json({ error: "PIN incorreto." });
        }

        const state = await fetchState();
        res.json({
            user: { id: user.id, name: user.name, role: user.role },
            state
        });
    } catch (error) {
        console.error('Erro ao processar login:', error);
        res.status(500).json({ error: "Erro interno: " + (error.message || "Verifique o terminal.") });
    }
});

app.post("/api/users", async (req, res, next) => {
    try {
        const { name, role, pin } = req.body;
        if (!name || !role || !pin) {
            return res.status(400).json({ error: "Todos os campos são obrigatórios." });
        }
        await pool.query(
            'INSERT INTO app_users (name, role, pin_code, active) VALUES ($1, $2, $3, true)',
            [name, role, pin]
        );
        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        next(error);
    }
});

app.post("/api/supplies", async (req, res, next) => {
    try {
        const { code, name, category, qty, min, supplier, note } = req.body;
        if (!code || !name || !category) {
            return res.status(400).json({ error: "Campos obrigatórios ausentes." });
        }
        await pool.query(
            'INSERT INTO supplies (code, name, category, current_quantity, minimum_quantity, supplier, note) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [code, name, category, Number(qty || 0), Number(min || 0), supplier || null, note || null]
        );
        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        next(error);
    }
});

app.put("/api/supplies/:code", async (req, res, next) => {
    try {
        const { code } = req.params;
        const { name, category, qty, min, supplier, note } = req.body;
        
        await pool.query(
            'UPDATE supplies SET name = $1, category = $2, current_quantity = $3, minimum_quantity = $4, supplier = $5, note = $6 WHERE code = $7',
            [name, category, Number(qty || 0), Number(min || 0), supplier || null, note || null, code]
        );
        
        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        next(error);
    }
});

app.post("/api/movements/withdraw", async (req, res, next) => {
    try {
        // A tela envia "technician" e "destination" em vez de IDs
        const { code, technician, destination, quantity } = req.body;
        
        // 1. Achar o Insumo
        const supplyResult = await pool.query('SELECT id FROM supplies WHERE code = $1', [code]);
        if (supplyResult.rows.length === 0) return res.status(400).json({ error: "Insumo não encontrado." });
        const supplyId = supplyResult.rows[0].id;

        // 2. Achar o Usuário (Técnico)
        const userResult = await pool.query('SELECT id FROM app_users WHERE name = $1', [technician]);
        if (userResult.rows.length === 0) return res.status(400).json({ error: "Usuário não encontrado." });
        const userId = userResult.rows[0].id;

        // 3. Achar o Destino (Opcional - vamos tentar achar o ID, se não achar fica nulo)
        let destId = null;
        if (destination) {
            const destResult = await pool.query('SELECT id FROM destinations WHERE name = $1', [destination]);
            if (destResult.rows.length > 0) destId = destResult.rows[0].id;
        }

        // 4. Criar a Solicitação Pendente
        await pool.query(
            'INSERT INTO stock_requests (supply_id, user_id, destination_id, quantity, status) VALUES ($1, $2, $3, $4, $5)',
            [supplyId, userId, destId, Number(quantity) || 1, 'pending']
        );

        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        next(error);
    }
});

app.post("/api/movements/return", async (req, res, next) => {
    try {
        const { code, quantity } = req.body;
        const supplyResult = await pool.query('SELECT id FROM supplies WHERE code = $1', [code]);
        if (supplyResult.rows.length === 0) return res.status(400).json({ error: "Insumo não encontrado." });
        
        await pool.query(
            'UPDATE supplies SET current_quantity = current_quantity + $1 WHERE id = $2',
            [Number(quantity) || 0, supplyResult.rows[0].id]
        );
        
        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) { next(error); }
});

app.post("/api/movements/replenish", async (req, res, next) => {
    try {
        const { code, quantity } = req.body;
        const supplyResult = await pool.query('SELECT id FROM supplies WHERE code = $1', [code]);
        if (supplyResult.rows.length === 0) return res.status(400).json({ error: "Insumo não encontrado." });
        
        await pool.query(
            'UPDATE supplies SET current_quantity = current_quantity + $1 WHERE id = $2',
            [Number(quantity) || 0, supplyResult.rows[0].id]
        );
        
        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) { next(error); }
});

app.post("/api/requests/:id/approve", async (req, res, next) => {
    try {
        const { id } = req.params;
        const requestResult = await pool.query(
            "UPDATE stock_requests SET status = 'approved', approved_at = now() WHERE id = $1 RETURNING supply_id, quantity",
            [id]
        );
        if (requestResult.rows.length > 0) {
            const { supply_id, quantity } = requestResult.rows[0];
            await pool.query(
                'UPDATE supplies SET current_quantity = current_quantity - $1 WHERE id = $2',
                [quantity, supply_id]
            );
        }
        
        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) { next(error); }
});

app.get("/api/events", (req, res) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
    });
    res.write("\n");
    liveClients.add(res);
    req.on("close", () => {
        liveClients.delete(res);
    });
});

// Fallback SPA - Somente se não for arquivo físico nem rota da API
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.use((err, req, res, next) => {
    console.error("❌ Erro capturado pelo middleware:", err);
    res.status(500).json({ error: "Erro interno: " + (err.message || "Verifique o terminal.") });
});

const server = app.listen(port, host, () => {
    console.log(`✅ Servidor ativo na porta ${port}`);
});
