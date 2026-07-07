require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4173);
const host = "0.0.0.0"; 
const liveClients = new Set();

// Configuração estável da conexão com o PostgreSQL do Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Servir arquivos estáticos da pasta atual garantindo caminhos absolutos
app.use(express.static(path.join(__dirname, "./")));

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
        
        const result = await pool.query(
            'SELECT id, name, role, pin_code FROM app_users WHERE name = $1 AND active = true',
            [name]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Usuário não encontrado ou inativo." });
        }

        const user = result.rows[0];
        if (pin !== user.pin_code) {
            return res.status(400).json({ error: "PIN incorreto." });
        }

        const state = await fetchState();
        res.json({ 
            user: { id: user.id, name: user.name, role: user.role }, 
            state 
        });
    } catch (error) {
        console.error('Erro ao processar login:', error);
        res.status(500).json({ error: "Erro interno ao processar login" });
    }
});

// ROTA ADICIONADA: Cadastrar Novo Usuário no Supabase
app.post("/api/users", async (req, res, next) => {
    try {
        const { name, role, pin } = req.body;
        if (!name || !role || !pin) {
            return res.status(400).json({ error: "Todos os campos de usuário são obrigatórios." });
        }

        await pool.query(
            'INSERT INTO app_users (name, role, pin_code, active) VALUES ($1, $2, $3, true)',
            [name, role, pin]
        );

        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        console.error("Erro ao cadastrar usuário:", error);
        next(error);
    }
});

// ROTA ADICIONADA: Cadastrar Novo Insumo no Supabase
app.post("/api/supplies", async (req, res, next) => {
    try {
        const { code, name, category, qty } = req.body;
        if (!code || !name || !category) {
            return res.status(400).json({ error: "Campos obrigatórios ausentes." });
        }

        // Verifica se o insumo já existe
        const exists = await pool.query('SELECT id FROM supplies WHERE code = $1', [code]);
        if (exists.rows.length > 0) {
            return res.status(400).json({ error: "Já existe um insumo registrado com este código." });
        }

        await pool.query(
            'INSERT INTO supplies (code, name, category, current_quantity, active) VALUES ($1, $2, $3, $4, true)',
            [code, name, category, Number(qty || 0)]
        );

        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        console.error("Erro ao cadastrar insumo:", error);
        next(error);
    }
});

app.post("/api/movements/withdraw", async (req, res, next) => {
    try {
        const { code, user_id, destination_id, quantity } = req.body;

        const supplyResult = await pool.query(
            'SELECT id, code, name, current_quantity FROM supplies WHERE code = $1',
            [code]
        );

        if (supplyResult.rows.length === 0) {
            return res.status(400).json({ error: "Insumo não encontrado." });
        }

        const supply = supplyResult.rows[0];
        if (supply.current_quantity < quantity) {
            return res.status(400).json({ error: "Quantidade insuficiente em estoque." });
        }

        await pool.query(
            `INSERT INTO stock_movements 
            (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after, note)
            VALUES ($1, $2, $3, 'withdrawal', $4, $5, $6, 'Retirada via interface')`,
            [supply.id, user_id, destination_id, quantity, supply.current_quantity, supply.current_quantity - quantity]
        );

        await pool.query(
            'UPDATE supplies SET current_quantity = current_quantity - $1 WHERE id = $2',
            [quantity, supply.id]
        );

        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        next(error);
    }
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

// Fallback SPA - Serve sempre o arquivo index.html absoluto
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.use((err, req, res, next) => {
    console.error("❌ Erro capturado pelo middleware:", err);
    res.status(500).json({ error: err.message || "Erro interno no servidor." });
});

const server = app.listen(port, host, () => {
    console.log(`✅ Servidor rodando com sucesso em http://${host}:${port}`);
});

process.on('SIGTERM', () => {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
});