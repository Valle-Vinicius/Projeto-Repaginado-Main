const movimentacaoService = require('../services/movimentacaoService');

async function listar(req, res, next) {
  try {
    const { tipo, produtoId, categoriaId, dataInicio, dataFim, pagina, limite } = req.query;

    const resultado = await movimentacaoService.listarMovimentacoes({
      tipo: tipo ? String(tipo).toUpperCase() : undefined,
      produtoId: produtoId ? Number(produtoId) : undefined,
      categoriaId: categoriaId ? Number(categoriaId) : undefined,
      dataInicio,
      dataFim,
      pagina: pagina ? parseInt(pagina, 10) : 1,
      limite: limite ? parseInt(limite, 10) : 10
    });

    return res.status(200).json({
      sucesso: true,
      dados: resultado.dados || resultado,
      total: resultado.total,
      pagina: resultado.pagina,
      limite: resultado.limite
    });
  } catch (error) {
    next(error);
  }
}


async function obterPorId(req, res, next) {
  try {
    const { id } = req.params;
    const movimentacao = await movimentacaoService.obterMovimentacaoPorId(id);

    return res.status(200).json({
      sucesso: true,
      dados: movimentacao
    });
  } catch (error) {
    next(error);
  }
}

async function criar(req, res, next) {
  try {
    const { produtoId, quantidade, tipo, origemId, destinoId, motivo, loteId } = req.body;
    const usuarioId = req.usuario?.id || req.user?.id; 
    const novaMovimentacao = await movimentacaoService.registrarMovimentacao({
      produtoId,
      quantidade,
      tipo,
      origemId,
      destinoId,
      motivo,
      loteId,
      usuarioId
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: 'Movimentação registrada com sucesso.',
      dados: novaMovimentacao
    });
  } catch (error) {
    next(error);
  }
}

async function estornar(req, res, next) {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    const usuarioId = req.usuario?.id || req.user?.id;

    const estorno = await movimentacaoService.estornarMovimentacao(id, {
      motivo,
      usuarioId
    });

    return res.status(200).json({
      sucesso: true,
      mensagem: 'Movimentação estornada com sucesso.',
      dados: estorno
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  obterPorId,
  criar,
  estornar
};