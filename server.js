require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = Number(process.env.PORT || 4173);

// Inicialização oficial do Banco de Dados Supabase no Servidor
const supabaseUrl = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxem51YXJjd2l3aW9kdGhka3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzOTMwNDcsImV4cCI6MjA5ODk2OTA0N30.J2FAa-JcWJuLef6vwI7D3aGu8pwoo1VrKG_RTraHE3Q';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxem51YXJjd2l3aW9kdGhka3N2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzM5MzA0NywiZXhwIjoyMDk4OTY5MDQ3fQ.gu7xaCoVotk8kGpUPCR3Xrw2HPopw9d4OSfHn9dDXFk';
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Rota de Inicialização (Bootstrap)
app.get("/api/bootstrap", async (req, res, next) => {
    try {
        // Busca os dados do banco para alimentar o dashboard
        const { data: items } = await supabase.from('items').select('*');
        const { data: requests } = await supabase.from('requests').select('*').eq('status', 'pending');
        const { data: history } = await supabase.from('history').select('*').order('at', { ascending: false }).limit(20);

        res.json({
            items: items || [],
            requests: requests || [],
            history: history || [],
            users: [
                { name: "Administrador", role: "admin" },
                { name: "Luiz", role: "tecnico" },
                { name: "Henrique", role: "tecnico" },
                { name: "Joao", role: "tecnico" },
                { name: "Gabriel", role: "tecnico" }
            ],
            technicians: ["Luiz", "Henrique", "Joao", "Gabriel"],
            destinations: ["Bancada 01", "Bancada 02", "Bancada 03", "Bancada 04", "Servico interno", "Estoque de testes", "Outro"]
        });
    } catch (error) {
        next(error);
    }
});

// Rota de Login
app.post("/api/login", async (req, res) => {
    const { name, pin } = req.body;
    // Regra simples de login baseada no seedState do seu app.js
    const users = [
        { name: "Administrador", role: "admin" },
        { name: "Luiz", role: "tecnico" },
        { name: "Henrique", role: "tecnico" },
        { name: "Joao", role: "tecnico" },
        { name: "Gabriel", role: "tecnico" }
    ];

    const user = users.find(u => u.name.toLowerCase() === name.trim().toLowerCase());
    if (!user) return res.status(400).json({ error: "Usuário não encontrado." });

    const expectedPin = user.role === "admin" ? "0000" : "1111";
    if (pin !== expectedPin) return res.status(400).json({ error: "PIN incorreto." });

    res.json({ user, state: {} });
});

// Garante que o index.html abra em qualquer outra rota
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`Servidor StockFlow rodando na porta ${port}`);
});