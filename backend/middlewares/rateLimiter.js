const rateLimit = require('express-rate-limit');

function formatarTempoEspera(segundos) {
  const minutos = Math.floor(segundos / 60);
  const restante = segundos % 60;
  if (minutos === 0) {
    return `${segundos} segundo${segundos === 1 ? '' : 's'}`;
  }
  if (restante === 0) {
    return `${minutos} minuto${minutos === 1 ? '' : 's'}`;
  }
  return `${minutos} min e ${restante} s`;
}

function criarMensagem(codigo, mensagemBase) {
  return (_req, res) => {
    const retryAfter = Number(res.getHeader('Retry-After'));
    const mensagem = Number.isFinite(retryAfter) && retryAfter > 0
      ? `${mensagemBase} Tente novamente em ${formatarTempoEspera(retryAfter)}.`
      : mensagemBase;
    return {
      sucesso: false,
      codigo,
      mensagem,
      retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    };
  };
}

/**
 * Rate limiting por IP para endpoints sensíveis.
 * Prevene ataques de força bruta e cadastros em massa.
 */

// Login: 5 tentativas a cada 15 minutos por IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  skip: () => process.env.NODE_ENV === 'test',
  message: criarMensagem('MUITAS_TENTATIVAS', 'Muitas tentativas de login.'),
  standardHeaders: true,
  legacyHeaders: false,
});

// Geral para API: 500 requisições a cada 15 minutos por IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  skip: () => process.env.NODE_ENV === 'test',
  message: criarMensagem('LIMITE_EXCEDIDO', 'Muitas requisições.'),
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  loginLimiter,
  apiLimiter,
};
