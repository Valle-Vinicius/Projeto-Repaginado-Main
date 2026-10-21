const rateLimit = require('express-rate-limit');

/**
 * Rate limiting por IP para endpoints sensíveis.
 * Prevene ataques de força bruta e cadastros em massa.
 */

// Login: 5 tentativas a cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    sucesso: false,
    codigo: 'MUITAS_TENTATIVAS',
    mensagem: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cadastro: 3 cadastros a cada hora por IP
const cadastroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    sucesso: false,
    codigo: 'MUITOS_CADASTROS',
    mensagem: 'Limite de cadastros atingido. Tente novamente em 1 hora.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Geral para API: 100 req a cada 15 min por IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    sucesso: false,
    codigo: 'LIMITE_EXCEDIDO',
    mensagem: 'Muitas requisições. Tente novamente em 15 minutos.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  cadastroLimiter,
  apiLimiter,
};