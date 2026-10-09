const service = require("../services/perfilService");
function responderErro(res, erro) {
  console.error("[Perfil]", { mensagem: erro.message, codigo: erro.codigo });
  return res
    .status(erro.statusCode || 500)
    .json({
      sucesso: false,
      codigo: erro.codigo || "ERRO_PERFIL",
      mensagem: erro.statusCode
        ? erro.message
        : "Não foi possível atualizar o perfil agora.",
    });
}
async function obter(req, res) {
  try {
    return res.json({
      sucesso: true,
      usuario: await service.obter(req.usuario.id),
    });
  } catch (e) {
    return responderErro(res, e);
  }
}
async function atualizar(req, res) {
  try {
    return res.json({
      sucesso: true,
      usuario: await service.atualizar(req.usuario.id, req.body || {}),
    });
  } catch (e) {
    return responderErro(res, e);
  }
}
module.exports = { obter, atualizar };
