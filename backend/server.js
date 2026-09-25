require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const produtoRoutes = require('./routes/produtoRoutes');
const estoqueRoutes = require('./routes/estoqueRoutes');
const recebimentoRoutes = require('./routes/recebimentoRoutes');
const expedicaoRoutes = require('./routes/expedicaoRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const { verificarToken } = require('./middlewares/authMiddleware');

const app = express();
const PORT = process.env.PORT || 3000;
const CAMINHO_FRONTEND = path.join(__dirname, '..', 'frontend');
const CAMINHO_LOGIN = path.join(CAMINHO_FRONTEND, 'pages', 'login.html');
const CAMINHO_ERRO_404 = path.join(CAMINHO_FRONTEND, 'pages', 'erro404.html');

app.use(cors());
app.use(express.json({
  limit: '10kb',
  strict: true
}));
app.use(express.static(CAMINHO_FRONTEND, { index: false }));

app.get('/', (req, res) => {
  res.redirect(302, '/pages/login.html');
});

app.get('/api/health', (req, res) => {
  res.json({
    sucesso: true,
    status: 'ok'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/produtos', produtoRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/recebimentos', recebimentoRoutes);
app.use('/api/expedicoes', expedicaoRoutes);
app.use('/api/auditorias', auditoriaRoutes);

app.get('/api/perfil', verificarToken, (req, res) => {
  res.json({
    sucesso: true,
    mensagem: 'Você está autenticado.',
    usuario: req.usuario
  });
});

// Erros do parser JSON: requisições inválidas não devem retornar HTML técnico.
app.use((erro, req, res, next) => {
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({
      sucesso: false,
      codigo: 'PAYLOAD_MUITO_GRANDE',
      mensagem: 'A requisição ultrapassa o tamanho permitido.'
    });
  }

  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({
      sucesso: false,
      codigo: 'JSON_INVALIDO',
      mensagem: 'O corpo da requisição contém um JSON inválido.'
    });
  }

  console.error('[Servidor]', {
    mensagem: erro.message,
    codigo: erro.code
  });

  return next(erro);
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      sucesso: false,
      codigo: 'ROTA_NAO_ENCONTRADA',
      mensagem: 'Rota da API não encontrada.'
    });
  }

  return res.status(404).sendFile(CAMINHO_ERRO_404);
});

app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);

  return res.status(500).json({
    sucesso: false,
    codigo: 'ERRO_INTERNO',
    mensagem: 'Não foi possível concluir a requisição agora.'
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Babycare rodando em http://localhost:${PORT}`);
});
