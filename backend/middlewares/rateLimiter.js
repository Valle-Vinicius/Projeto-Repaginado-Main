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

// Geral para API: 100 req a cada 15 min por IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  skip: () => process.env.NODE_ENV === 'test',
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
  apiLimiter,
};
