const { executarQuery } = require('../config/database');

function serializarDetalhes(detalhes) {
  if (detalhes === undefined || detalhes === null) {
    return JSON.stringify({});
  }

  try {
    return JSON.stringify(detalhes);
  } catch (erro) {
    throw new Error('Os detalhes da auditoria não puderam ser convertidos para JSON.');
  }
}

async function registrar({
  usuarioId = null,
  acao,
  entidade = null,
  entidadeId = null,
  resultado = 'SUCESSO',
  detalhes = {}
} = {}) {
  if (!acao || typeof acao !== 'string') {
    throw new Error('A ação da auditoria é obrigatória.');
  }

  const resultadoNormalizado = resultado === 'FALHA' ? 'FALHA' : 'SUCESSO';
  const detalhesJson = serializarDetalhes(detalhes);

  const resultadoInsert = await executarQuery(
    `INSERT INTO auditorias
      (usuario_id, acao, entidade, entidade_id, resultado, detalhes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      usuarioId,
      acao.trim(),
      entidade,
      entidadeId,
      resultadoNormalizado,
      detalhesJson
    ]
  );

  return {
    id: resultadoInsert.insertId,
    acao: acao.trim(),
    resultado: resultadoNormalizado
  };
}

module.exports = {
  registrar
};
