require("dotenv").config();

const path = require("path");
const os = require("os");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");

const AuthController = require("./controllers/AuthController");
const UsuarioController = require("./controllers/UsuarioController");
const ProdutoController = require("./controllers/ProdutoController");
const EstoqueController = require("./controllers/EstoqueController");
const AuthService = require("./services/AuthService");
const UsuarioService = require("./services/UsuarioService");
const ProdutoService = require("./services/ProdutoService");
const EstoqueService = require("./services/EstoqueService");
const RelatorioService = require("./services/RelatorioService");
const RealtimeService = require("./services/RealtimeService");
const createAuthRoutes = require("./routes/auth");
const createUsuariosRoutes = require("./routes/usuarios");
const createProdutosRoutes = require("./routes/produtos");
const createEstoqueRoutes = require("./routes/estoque");
const createRelatoriosRoutes = require("./routes/relatorios");
const authMiddleware = require("./middleware/auth");

const app = express();
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;
const databaseSsl = process.env.DATABASE_SSL === "true" || /sslmode=require/i.test(databaseUrl || "");
const jwtSecret = process.env.JWT_SECRET || "stockflow-dev-secret-change-me";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseSsl ? { rejectUnauthorized: false } : undefined
});

const realtimeService = new RealtimeService();
const relatorioService = new RelatorioService(pool);
const usuarioService = new UsuarioService(pool);
const produtoService = new ProdutoService(pool, relatorioService);
const estoqueService = new EstoqueService(pool, relatorioService);
const authService = new AuthService(pool, jwtSecret);

const authController = new AuthController(authService, relatorioService);
const usuarioController = new UsuarioController(usuarioService);
const produtoController = new ProdutoController(produtoService, realtimeService);
const estoqueController = new EstoqueController(estoqueService, relatorioService, realtimeService);
const requireAuth = authMiddleware(jwtSecret);

app.disable("x-powered-by");
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.use("/api", createAuthRoutes(authController, requireAuth));
app.use("/api", requireAuth);
app.use("/api/usuarios", createUsuariosRoutes(usuarioController));
app.use("/api/produtos", createProdutosRoutes(produtoController));
app.use("/api/items", createProdutosRoutes(produtoController));
app.use("/api", createEstoqueRoutes(estoqueController));
app.use("/api/relatorios", createRelatoriosRoutes(relatorioService));

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
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
