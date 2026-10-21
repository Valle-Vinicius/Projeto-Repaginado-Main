const jwt = require('jsonwebtoken');

function verificarToken(req, res, next) {
  // Prioriza cookie httpOnly (mais seguro); fallback para Authorization header
  const autorizacao = req.headers.authorization;
  const token = req.cookies?.babycareToken
    ? req.cookies.babycareToken
    : autorizacao && autorizacao.startsWith('Bearer ')
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
    const dadosToken = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256']
    });
    req.usuario = dadosToken;
    req.valor = dadosToken;
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
    const usuario = req.usuario || req.valor;

    if (!usuario || !perfisPermitidos.includes(usuario.perfil)) {
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