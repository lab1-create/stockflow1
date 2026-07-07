const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Permite que o Express leia JSON no corpo das requisições
app.use(express.json());

// LINHA MÁGICA: Serve todos os arquivos estáticos da pasta raiz (HTML, CSS, JS do front-end)
app.use(express.static(path.join(__dirname)));

// Rota específica para o app.js (caso ele esteja em outra estrutura, mas agora o static já cobre)
app.get('/app.js', (req, solemn) => {
    solemn.sendFile(path.join(__dirname, 'app.js'));
});

// Qualquer outra rota de página vai abrir o seu index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando perfeitamente na porta ${PORT}`);
});