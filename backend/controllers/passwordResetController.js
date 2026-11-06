const service = require('../services/passwordResetService');

function responderErro(res, erro) {
  return res.status(erro.statusCode || 500).json({
    sucesso: false,
    codigo: erro.codigo || 'ERRO_RESET',
    mensagem: erro.statusCode ? erro.message : 'Não foi possível processar a solicitação.',
  });
}

async function solicitar(req, res) {
  try {
    const resultado = await service.solicitarReset(req.body?.email);
    return res.json(resultado);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function redefinir(req, res) {
  try {
    const resultado = await service.redefinirSenha(req.body?.token, req.body?.novaSenha);
    return res.json(resultado);
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = { solicitar, redefinir };
