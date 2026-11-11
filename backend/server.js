require('dotenv').config();

const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const estoqueRoutes = require('./routes/estoqueRoutes');
const recebimentoRoutes = require('./routes/recebimentoRoutes');
const expedicaoRoutes = require('./routes/expedicaoRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const relatorioRoutes = require('./routes/relatorioRoutes');
const validadeRoutes = require('./routes/validadeRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const perfilRoutes = require('./routes/perfilRoutes');
const passwordResetRoutes = require('./routes/passwordResetRoutes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./docs/swagger');
const { verificarToken } = require('./middlewares/authMiddleware');
const { apiLimiter } = require('./middlewares/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PRODUCAO = process.env.NODE_ENV === 'production';
const CAMINHO_FRONTEND = path.join(__dirname, '..', 'frontend', IS_PRODUCAO ? 'dist' : '');
const CAMINHO_PAGINAS = path.join(CAMINHO_FRONTEND, 'src', 'pages');
const CAMINHO_LOGIN = path.join(CAMINHO_PAGINAS, 'login', 'index.html');
const CAMINHO_ERRO_404 = path.join(CAMINHO_PAGINAS, 'erro404', 'index.html');

// Trust proxy for correct IP detection behind reverse proxies
app.set('trust proxy', 1);

// === SEGURANÇA: Headers de segurança ===
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  next();
});

// === SEGURANÇA: CORS restrito ===
const ORIGENS_PERMITIDAS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : [process.env.RENDER_EXTERNAL_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'].filter(
      Boolean
    );

app.use(
  cors({
    origin: ORIGENS_PERMITIDAS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(cookieParser());
app.use(
  express.json({
    limit: '10kb',
    strict: true,
  })
);

// SEGURANÇA: Servir login e 404 publicamente; páginas internas exigem autenticação prévia
if (IS_PRODUCAO) {
  app.get('/', (req, res) => {
    res.redirect(302, '/login');
  });

  app.get('/pages/login.html', (req, res) => {
    res.sendFile(CAMINHO_LOGIN);
  });

  app.get('/pages/erro404.html', (req, res) => {
    res.sendFile(CAMINHO_ERRO_404);
  });

  // Guardião de rotas HTML internas: redireciona para login se não autenticado
  app.get('/pages/*.html', (req, res, next) => {
    const token =
      req.cookies?.babycareToken ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : null);

    if (!token) {
      return res.redirect(302, '/pages/login.html');
    }

    try {
      const jwt = require('jsonwebtoken');
      jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      return next();
    } catch (erro) {
      res.clearCookie('babycareToken', {
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
      });
      return res.redirect(302, '/pages/login.html');
    }
  });

  // Em produção, mapear URLs limpas para as páginas geradas pelo Vite (MPA)
  const paginasVite = [
    'login',
    'dashboard',
    'produtos',
    'estoque',
    'recebimentos',
    'expedicoes',
    'auditoria',
    'relatorios',
    'validade',
    'usuarios',
    'configuracoes',
    'formulario-produto',
    'redefinir-senha',
    'erro404',
  ];

  paginasVite.forEach((pagina) => {
    const caminhoPagina = path.join(CAMINHO_PAGINAS, pagina, 'index.html');
    app.get(`/${pagina}`, (req, res) => {
      res.sendFile(caminhoPagina);
    });
  });

  paginasVite.forEach((pagina) => {
    app.get(`/${pagina}.html`, (req, res) => {
      res.redirect(302, `/${pagina}`);
    });
  });

  // Redireciona raiz para login em produção
  app.get('/', (req, res) => {
    res.redirect(302, '/login');
  });
}

// CSS, JS e imagens do frontend (necessários para login e aplicação)
if (IS_PRODUCAO) {
  app.use(
    express.static(CAMINHO_FRONTEND, {
      index: false,
      setHeaders: (res, filePath) => {
        const ext = path.extname(filePath).toLowerCase();
        // Garante charset UTF-8 para arquivos de texto
        const mimeTypes = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.txt': 'text/plain',
          '.svg': 'image/svg+xml',
        };
        if (mimeTypes[ext]) {
          res.setHeader('Content-Type', mimeTypes[ext] + '; charset=UTF-8');
        }
        if (
          !['.css', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf'].includes(ext)
        ) {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        }
      },
    })
  );
}

const { pool, inicializarBanco } = require('./config/database');

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({
      sucesso: true,
      status: 'ok',
      banco: 'conectado',
    });
  } catch (erro) {
    return res.status(503).json({
      sucesso: false,
      status: 'erro',
      banco: 'desconectado',
    });
  }
});

app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/produtos', produtoRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/recebimentos', recebimentoRoutes);
app.use('/api/expedicoes', expedicaoRoutes);
app.use('/api/auditorias', auditoriaRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/validade', validadeRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/usuario', usuarioRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/auth', passwordResetRoutes);

// Documentação da API (apenas autenticados)
app.get('/api-docs', verificarToken, swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Erros do parser JSON
app.use((erro, req, res, next) => {
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({
      sucesso: false,
      codigo: 'PAYLOAD_MUITO_GRANDE',
      mensagem: 'A requisição ultrapassa o tamanho permitido.',
    });
  }

  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({
      sucesso: false,
      codigo: 'JSON_INVALIDO',
      mensagem: 'O corpo da requisição contém um JSON inválido.',
    });
  }

  // SEGURANÇA: Não expor detalhes do banco de dados em logs
  console.error('[Servidor]', {
    mensagem: erro.message,
    codigo: erro.code,
  });

  return next(erro);
});

// 404
if (IS_PRODUCAO) {
  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({
        sucesso: false,
        codigo: 'ROTA_NAO_ENCONTRADA',
        mensagem: 'Rota da API não encontrada.',
      });
    }

    return res.status(404).sendFile(CAMINHO_ERRO_404);
  });
}

// Tratamento de erros sem information disclosure
app.use((erro, req, res, next) => {
  if (res.headersSent) {
    return next(erro);
  }

  // SEGURANÇA: Nunca retornar detalhes internos do erro
  console.error('[Servidor][Erro não tratado]', {
    mensagem: erro.message,
    stack: erro.stack,
  });

  return res.status(500).json({
    sucesso: false,
    codigo: 'ERRO_INTERNO',
    mensagem: 'Não foi possível concluir a requisição agora.',
  });
});

let servidor;
async function criarAdministradorInicial() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const senha = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email && !senha) {
    return;
  }
  if (!email || !senha || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || senha.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL inválido ou senha com menos de 12 caracteres.');
  }

  const administradorExistente = await pool.query(
    `SELECT u.id
       FROM usuarios u
       INNER JOIN perfis p ON p.id = u.perfil_id
      WHERE p.nome = 'ADMINISTRADOR'
      LIMIT 1`
  );
  if (administradorExistente.rowCount > 0) {
    console.log('[Servidor] Bootstrap ignorado: já existe um administrador.');
    delete process.env.BOOTSTRAP_ADMIN_EMAIL;
    delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
    return;
  }

  const perfil = await pool.query(
    "SELECT id FROM perfis WHERE nome = 'ADMINISTRADOR' AND ativo = TRUE LIMIT 1"
  );
  if (!perfil.rowCount) {
    throw new Error('Perfil ADMINISTRADOR não encontrado no banco.');
  }

  const departamento = await pool.query(
    "SELECT id FROM departamentos WHERE nome = 'Administração' AND ativo = TRUE LIMIT 1"
  );
  const senhaHash = await bcrypt.hash(senha, 12);
  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil_id, departamento_id, ativo)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [
      process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrador Babycare',
      email,
      senhaHash,
      perfil.rows[0].id,
      departamento.rows[0]?.id || null,
    ]
  );

  delete process.env.BOOTSTRAP_ADMIN_EMAIL;
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD;
  delete process.env.BOOTSTRAP_ADMIN_NAME;
  console.log('[Servidor] Administrador inicial criado.');
}

inicializarBanco()
  .then(criarAdministradorInicial)
  .then(() => {
    servidor = app.listen(PORT, () => {
      console.log(`Servidor Babycare rodando em http://localhost:${PORT}`);
    });
  })
  .catch((erro) => {
    console.error('[Servidor] Falha ao inicializar o banco:', {
      mensagem: erro.message,
      codigo: erro.code,
    });
    process.exit(1);
  });

// Graceful shutdown
function encerrarServidor(sinal) {
  console.log(`\n[Servidor] Recebido ${sinal}. Encerrando...`);
  servidor.close(async () => {
    try {
      await pool.end();
      console.log('[Servidor] Pool de conexões fechado.');
    } catch (erro) {
      console.error('[Servidor] Erro ao fechar pool:', erro.message);
    }
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('[Servidor] Forçando encerramento após timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => encerrarServidor('SIGTERM'));
process.on('SIGINT', () => encerrarServidor('SIGINT'));

process.on('uncaughtException', (erro) => {
  console.error('[Servidor] Exceção não tratada:', erro.message, erro.stack);
  process.exit(1);
});

process.on('unhandledRejection', (razao) => {
  console.error('[Servidor] Promise rejeitada não tratada:', razao);
});
