const estoqueService = require("../services/estoqueService");

function responderErro(res, erro) {
  console.error("[Estoque/Recebimentos/Expedições]", {
    mensagem: erro.message,
    codigo: erro.codigo,
  });
  return res
    .status(erro.statusCode || 500)
    .json({
      sucesso: false,
      codigo: erro.codigo || "ERRO_ESTOQUE",
      mensagem: erro.statusCode
        ? erro.message
        : "Não foi possível concluir a operação de estoque.",
    });
}

async function listarEstoque(req, res) {
  try {
    return res.json({
      sucesso: true,
      ...(await estoqueService.obterEstoqueCompleto()),
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}
async function listarExpedicoes(req, res) {
  try {
    return res.json({
      sucesso: true,
      expedicoes: await estoqueService.listarExpedicoes(),
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}
async function listarRecebimentos(req, res) {
  try {
    return res.json({
      sucesso: true,
      recebimentos: await estoqueService.listarRecebimentos(),
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}
async function registrarMovimentacao(req, res) {
  try {
    const dados = await estoqueService.registrarMovimentacao(
      req.body || {},
      req.usuario,
    );
    return res
      .status(201)
      .json({
        sucesso: true,
        mensagem: "Movimentação registrada e estoque atualizado.",
        dados,
      });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = {
  listarEstoque,
  listarExpedicoes,
  listarRecebimentos,
  registrarMovimentacao,
};
