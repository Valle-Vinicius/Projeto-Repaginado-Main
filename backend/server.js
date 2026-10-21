require("dotenv").config();

const path = require("path");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const produtoRoutes = require("./routes/produtoRoutes");
const estoqueRoutes = require("./routes/estoqueRoutes");
const recebimentoRoutes = require("./routes/recebimentoRoutes");
const expedicaoRoutes = require("./routes/expedicaoRoutes");
const auditoriaRoutes = require("./routes/auditoriaRoutes");
const relatorioRoutes = require("./routes/relatorioRoutes");
const validadeRoutes = require("./routes/validadeRoutes");
const usuarioRoutes = require("./routes/usuarioRoutes");
const perfilRoutes = require("./routes/perfilRoutes");
const { verificarToken } = require("./middlewares/authMiddleware");

const app = express();
const PORT = process.env.PORT || 3000;
const CAMINHO_FRONTEND = path.join(__dirname, "..", "frontend");
const CAMINHO_LOGIN = path.join(CAMINHO_FRONTEND, "pages", "login.html");
const CAMINHO_ERRO_404 = path.join(CAMINHO_FRONTEND, "pages", "erro404.html");

// === SEGURANÇA: Headers de segurança ===
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  next();
});

// === SEGURANÇA: CORS restrito ===
const ORIGENS_PERMITIDAS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  cors({
    origin: ORIGENS_PERMITIDAS,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(cookieParser());
app.use(
  express.json({
    limit: "10kb",
    strict: true,
  })
);

// SEGURANÇA: Servir login e 404 publicamente; páginas internas exigem autenticação prévia
app.get("/", (req, res) => {
  res.redirect(302, "/pages/login.html");
});

app.get("/pages/login.html", (req, res) => {
  res.sendFile(CAMINHO_LOGIN);
});

app.get("/pages/erro404.html", (req, res) => {
  res.sendFile(CAMINHO_ERRO_404);
});

// Guardião de rotas HTML internas: redireciona para login se não autenticado
app.get("/pages/*.html", (req, res, next) => {
  const token = req.cookies?.babycareToken
    || (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")
        ? req.headers.authorization.slice(7).trim()
        : null);

  if (!token) {
    return res.redirect(302, "/pages/login.html");
  }

  try {
    const jwt = require("jsonwebtoken");
    jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    return next();
  } catch (erro) {
    res.clearCookie("babycareToken", { path: "/" });
    return res.redirect(302, "/pages/login.html");
  }
});

// CSS, JS e imagens do frontend (necessários para login e aplicação)
app.use(
  express.static(CAMINHO_FRONTEND, {
    index: false,
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      // Não cachear arquivos JS para evitar arquivos desatualizados no navegador
      if (ext === '.js') {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      } else if (![".css", ".png", ".jpg", ".jpeg", ".svg", ".ico", ".woff", ".woff2", ".ttf"].includes(ext)) {
        res.setHeader("X-Robots-Tag", "noindex, nofollow");
      }
    },
  })
);

app.get("/api/health", (req, res) => {
  res.json({
    sucesso: true,
    status: "ok",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/produtos", produtoRoutes);
app.use("/api/estoque", estoqueRoutes);
app.use("/api/recebimentos", recebimentoRoutes);
app.use("/api/expedicoes", expedicaoRoutes);
app.use("/api/auditorias", auditoriaRoutes);
app.use("/api/relatorios", relatorioRoutes);
app.use("/api/validade", validadeRoutes);
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/usuario", usuarioRoutes);
app.use("/api/perfil", perfilRoutes);

// Erros do parser JSON
app.use((erro, req, res, next) => {
  if (erro.type === "entity.too.large") {
    return res.status(413).json({
      sucesso: false,
      codigo: "PAYLOAD_MUITO_GRANDE",
      mensagem: "A requisição ultrapassa o tamanho permitido.",
    });
  }

  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({
      sucesso: false,
      codigo: "JSON_INVALIDO",
      mensagem: "O corpo da requisição contém um JSON inválido.",
    });
  }

  // SEGURANÇA: Não expor detalhes do banco de dados em logs
  console.error("[Servidor]", {
    mensagem: erro.message,
    codigo: erro.code,
  });

  return next(erro);
});

// 404
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({
      sucesso: false,
      codigo: "ROTA_NAO_ENCONTRADA",
      mensagem: "Rota da API não encontrada.",
    });
  }

  return res.status(404).sendFile(CAMINHO_ERRO_404);
});

// Tratamento de erros sem information disclosure
app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);

  // SEGURANÇA: Nunca retornar detalhes internos do erro
  console.error("[Servidor][Erro não tratado]", {
    mensagem: erro.message,
    stack: erro.stack,
  });

  return res.status(500).json({
    sucesso: false,
    codigo: "ERRO_INTERNO",
    mensagem: "Não foi possível concluir a requisição agora.",
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Babycare rodando em http://localhost:${PORT}`);
});