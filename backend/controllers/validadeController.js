const validadeService = require("../services/validadeService");

function responderErro(res, erro) {
  console.error("[Validade]", { mensagem: erro.message, codigo: erro.codigo });
  return res.status(erro.statusCode || 500).json({
    sucesso: false,
    codigo: erro.codigo || "ERRO_VALIDADE",
    mensagem: erro.statusCode
      ? erro.message
      : "Não foi possível carregar as validades.",
  });
}

async function listar(req, res) {
  try {
    const dados = await validadeService.listar({
      status: req.query.status,
      busca: req.query.busca,
    });
    return res.json({ sucesso: true, ...dados });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = { listar };
