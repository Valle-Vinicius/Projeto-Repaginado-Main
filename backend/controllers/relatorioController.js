const service = require('../services/relatorioService');

async function consultar(req, res) {
  try {
    const dados = await service.obterRelatorio({
      periodo: req.query.periodo,
      tipo: req.query.tipo,
      categoriaId: req.query.categoriaId,
      produtoId: req.query.produtoId
    });
    return res.json({ sucesso: true, dados });
  } catch (erro) {
    console.error('[Relatórios]', { mensagem: erro.message, codigo: erro.codigo });
    return res.status(erro.statusCode || 500).json({
      sucesso: false,
      codigo: erro.codigo || 'ERRO_RELATORIO',
      mensagem: erro.statusCode ? erro.message : 'Não foi possível gerar o relatório agora.'
    });
  }
}

module.exports = { consultar };