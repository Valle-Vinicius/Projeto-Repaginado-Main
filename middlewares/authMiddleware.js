const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  const autorizacao = req.headers.authorization;
  const token = autorizacao && autorizacao.startsWith('Bearer ')
    ? autorizacao.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({
      sucesso: false,
      codigo: 'TOKEN_AUSENTE',
      mensagem: 'Token não informado.'
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error('[Auth][Token] JWT_SECRET não configurado.');
    return res.status(503).json({
      sucesso: false,
      codigo: 'CONFIGURACAO_JWT_AUSENTE',
      mensagem: 'O serviço de autenticação está temporariamente indisponível.'
    });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
    return next();
  } catch (erro) {
    return res.status(401).json({
      sucesso: false,
      codigo: 'TOKEN_INVALIDO',
      mensagem: 'Token inválido ou expirado.'
    });
  }
}

function permitirPerfis(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({
        sucesso: false,
        codigo: 'PERMISSAO_NEGADA',
        mensagem: 'Você não tem permissão para acessar este recurso.'
      });
    }

    return next();
  };
}

module.exports = {
  verificarToken,
  permitirPerfis
};
