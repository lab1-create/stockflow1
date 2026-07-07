require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "localhost";
const liveClients = new Set();

// Conexão com PostgreSQL via DATABASE_URL do Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname)));

// Função para buscar o estado atual direto das tabelas do Supabase
async function fetchState() {
    try {
        // Buscar usuários
        const usersResult = await pool.query('SELECT id, name, role, pin_code FROM app_users WHERE active = true');
        const users = usersResult.rows;

        // Buscar destinos
        const destResult = await pool.query('SELECT id, name FROM destinations WHERE active = true');
        const destinations = destResult.rows.map(d => d.name);

        // Buscar insumos
        const suppliesResult = await pool.query('SELECT id, code, name, category, current_quantity FROM supplies ORDER BY code ASC');
        const supplies = suppliesResult.rows;

        // Buscar movimentações (últimas 100)
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

        // Buscar solicitações
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

        return {
            users: users,
            destinations: destinations,
            supplies: supplies,
            movements: movements,
            requests: requests
        };
    } catch (error) {
        console.error('Erro ao buscar estado:', error);
        return { users: [], destinations: [], supplies: [], movements: [], requests: [] };
    }
}

function broadcastState(state) {
    const payload = JSON.stringify({ type: "state", data: state });
    for (const client of liveClients) {
        client.write(`event: state\ndata: ${payload}\n\n`);
    }
}

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
        
        // Buscar usuário no banco de dados
        const result = await pool.query(
            'SELECT id, name, role, pin_code FROM app_users WHERE name = $1 AND active = true',
            [name]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: "Usuário não encontrado." });
        }

        const user = result.rows[0];
        
        // Verificar PIN
        if (pin !== user.pin_code) {
            return res.status(400).json({ error: "PIN incorreto." });
        }

        // Login bem-sucedido
        const state = await fetchState();
        res.json({ 
            user: { id: user.id, name: user.name, role: user.role }, 
            state 
        });
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ error: "Erro ao processar login" });
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
        const { code, user_id, destination_id, quantity } = req.body;

        // Buscar insumo
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

        // Criar movimentação de retirada
        await pool.query(
            `INSERT INTO stock_movements 
            (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after, note)
            VALUES ($1, $2, $3, 'withdrawal', $4, $5, $6, 'Retirada via interface')`,
            [supply.id, user_id, destination_id, quantity, supply.current_quantity, supply.current_quantity - quantity]
        );

        // Atualizar quantidade
        await pool.query(
            'UPDATE supplies SET current_quantity = current_quantity - $1 WHERE id = $2',
            [quantity, supply.id]
        );

        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        console.error('Erro em withdraw:', error);
        next(error);
    }
});

app.post("/api/requests/:id/approve", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { admin_id } = req.body;

        // Buscar solicitação
        const reqResult = await pool.query(
            'SELECT * FROM stock_requests WHERE id = $1',
            [id]
        );

        if (reqResult.rows.length === 0) {
            return res.status(400).json({ error: "Solicitação não encontrada." });
        }

        const request = reqResult.rows[0];

        if (request.status !== "pending") {
            const state = await fetchState();
            return res.json(state);
        }

        // Atualizar status da solicitação
        await pool.query(
            'UPDATE stock_requests SET status = $1, approved_at = NOW(), approved_by = $2 WHERE id = $3',
            ['approved', admin_id, id]
        );

        // Executar movimentação
        const supply = await pool.query(
            'SELECT id, current_quantity FROM supplies WHERE id = $1',
            [request.supply_id]
        );

        if (supply.rows.length > 0) {
            const qty_before = supply.rows[0].current_quantity;
            const qty_after = Math.max(0, qty_before - request.quantity);

            await pool.query(
                `INSERT INTO stock_movements 
                (supply_id, user_id, destination_id, movement_type, quantity, quantity_before, quantity_after, note)
                VALUES ($1, $2, $3, 'withdrawal', $4, $5, $6, 'Aprovação de solicitação')`,
                [request.supply_id, request.user_id, request.destination_id, request.quantity, qty_before, qty_after]
            );

            await pool.query(
                'UPDATE supplies SET current_quantity = $1 WHERE id = $2',
                [qty_after, request.supply_id]
            );
        }

        const state = await fetchState();
        broadcastState(state);
        res.json(state);
    } catch (error) {
        console.error('Erro em approve:', error);
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

const server = app.listen(port, host, () => {
    console.log(`✅ Servidor rodando em http://localhost:${port}`);
    console.log(`📊 Conectado ao Supabase via DATABASE_URL`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\n⏹️  Encerrando servidor...');
    server.close(async () => {
        await pool.end();
        console.log('✅ Conexão encerrada');
        process.exit(0);
    });
});