const estoqueService = require('../services/estoqueService');
const { validarMovimentacao } = require('../validators/estoqueValidator');

function responderErro(res, erro, mensagemPadrao) {
  const status = erro.statusCode || (erro.code === 'ER_DUP_ENTRY' ? 409 : 500);
  const mensagem = erro.code === 'ER_DUP_ENTRY'
    ? 'Este lote já está cadastrado para o produto informado.'
    : (erro.message || mensagemPadrao);

  console.error('[estoque]', erro);
  return res.status(status).json({ mensagem });
}

async function obterEstoque(req, res) {
  try {
    const resultado = await estoqueService.obterEstoque({
      busca: req.query.busca,
      categoriaId: req.query.categoriaId,
      status: req.query.status,
      ordenacao: req.query.ordenacao
    });
    return res.json(resultado);
  } catch (erro) {
    return responderErro(res, erro, 'Não foi possível consultar o estoque.');
  }
}

async function listarRecebimentos(req, res) {
  try {
    const resultado = await estoqueService.obterRecebimentos({
      busca: req.query.busca,
      limite: req.query.limite
    });
    return res.json({ recebimentos: resultado });
  } catch (erro) {
    return responderErro(res, erro, 'Não foi possível consultar os recebimentos.');
  }
}

async function listarExpedicoes(req, res) {
  try {
    const resultado = await estoqueService.obterExpedicoes({
      busca: req.query.busca,
      limite: req.query.limite
    });
    return res.json({ expedicoes: resultado });
  } catch (erro) {
    return responderErro(res, erro, 'Não foi possível consultar as expedições.');
  }
}

async function registrarMovimentacao(req, res) {
  try {
    const movimentacao = validarMovimentacao(req.body);
    const resultado = await estoqueService.registrarMovimentacao({
      usuarioId: req.usuario.id,
      ...movimentacao
    });

    return res.status(201).json({
      mensagem: 'Movimentação registrada com sucesso.',
      ...resultado
    });
  } catch (erro) {
    return responderErro(res, erro, 'Não foi possível registrar a movimentação.');
  }
}

module.exports = {
  obterEstoque,
  listarRecebimentos,
  listarExpedicoes,
  registrarMovimentacao
};
