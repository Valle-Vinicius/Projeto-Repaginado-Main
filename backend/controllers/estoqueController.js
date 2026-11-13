const estoqueService = require('../services/estoqueService');

function responderErro(res, erro) {
  console.error('[Estoque/Recebimentos/Expedições]', {
    mensagem: erro.message,
    codigo: erro.codigo,
  });
  return res.status(erro.statusCode || 500).json({
    sucesso: false,
    codigo: erro.codigo || 'ERRO_ESTOQUE',
    mensagem: erro.statusCode ? erro.message : 'Não foi possível concluir a operação de estoque.',
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
    const dados = await estoqueService.registrarMovimentacao(req.body || {}, req.usuario);
    return res.status(201).json({
      sucesso: true,
      mensagem: 'Movimentação registrada e estoque atualizado.',
      dados,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

function registrarMovimentacaoDoTipo(tipoEsperado) {
  return async function registrar(req, res) {
    const tipoRecebido = String(req.body?.tipo || '')
      .trim()
      .toUpperCase();

    if (tipoRecebido !== tipoEsperado) {
      return res.status(400).json({
        sucesso: false,
        codigo: 'TIPO_MOVIMENTACAO_INVALIDO',
        mensagem: `Esta rota aceita somente movimentações do tipo ${tipoEsperado}.`,
      });
    }

    return registrarMovimentacao(req, res);
  };
}

async function ajustarEstoque(req, res) {
  try {
    const dados = await estoqueService.ajustarEstoque(req.body || {}, req.usuario);
    return res.status(200).json({
      sucesso: true,
      mensagem: 'Estoque ajustado com sucesso.',
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
  registrarRecebimento: registrarMovimentacaoDoTipo('ENTRADA'),
  registrarExpedicao: registrarMovimentacaoDoTipo('SAIDA'),
  ajustarEstoque,
};
