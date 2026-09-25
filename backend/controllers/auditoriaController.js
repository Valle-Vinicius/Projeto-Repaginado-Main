const auditoriaService = require('../services/auditoriaService');

async function listar(req, res) {
  try {
    const resultado = await auditoriaService.obterAuditoria({
      periodo: req.query.periodo,
      resultado: req.query.resultado,
      acao: req.query.acao,
      busca: req.query.busca
    });
    return res.json({ sucesso: true, dados: resultado });
  } catch (erro) {
    console.error('[Auditoria]', { mensagem: erro.message, codigo: erro.code });
    return res.status(erro.statusCode || 500).json({
      sucesso: false,
      codigo: erro.statusCode === 400 ? 'FILTRO_INVALIDO' : 'ERRO_AUDITORIA',
      mensagem: erro.statusCode === 400 ? erro.message : 'Não foi possível consultar a auditoria agora.'
    });
  }
}

module.exports = { listar };
