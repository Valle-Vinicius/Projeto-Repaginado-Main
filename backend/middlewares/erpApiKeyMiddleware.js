const crypto = require('crypto');

function verificarChaveERP(req, res, next) {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.status(403).json({
      sucesso: false,
      codigo: 'HTTPS_OBRIGATORIO',
      mensagem: 'A integração ERP exige uma conexão HTTPS.',
    });
  }

  const chaveEsperada = process.env.ERP_API_KEY || '';

  if (Buffer.byteLength(chaveEsperada, 'utf8') < 32) {
    return res.status(503).json({
      sucesso: false,
      codigo: 'INTEGRACAO_ERP_NAO_CONFIGURADA',
      mensagem: 'A integração ERP não está configurada no servidor.',
    });
  }

  const chaveRecebida = req.get('x-erp-api-key') || '';
  const esperada = Buffer.from(chaveEsperada, 'utf8');
  const recebida = Buffer.from(chaveRecebida, 'utf8');

  if (
    esperada.length !== recebida.length ||
    !crypto.timingSafeEqual(esperada, recebida)
  ) {
    return res.status(401).json({
      sucesso: false,
      codigo: 'CHAVE_ERP_INVALIDA',
      mensagem: 'Credencial de integração inválida.',
    });
  }

  return next();
}

module.exports = { verificarChaveERP };
