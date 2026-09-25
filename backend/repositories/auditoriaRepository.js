const { executarQuery } = require("../config/database");

function serializarDetalhes(detalhes) {
  if (detalhes === undefined || detalhes === null) return JSON.stringify({});
  try {
    return JSON.stringify(detalhes);
  } catch (erro) {
    throw new Error(
      "Os detalhes da auditoria não puderam ser convertidos para JSON.",
    );
  }
}

function normalizarDados({
  usuarioId = null,
  acao,
  entidade = null,
  entidadeId = null,
  resultado = "SUCESSO",
  detalhes = {},
} = {}) {
  if (!acao || typeof acao !== "string")
    throw new Error("A ação da auditoria é obrigatória.");
  const resultadoNormalizado = resultado === "FALHA" ? "FALHA" : "SUCESSO";
  return [
    usuarioId,
    acao.trim(),
    entidade,
    entidadeId,
    resultadoNormalizado,
    serializarDetalhes(detalhes),
  ];
}

async function registrarNaConexao(conexao, dados = {}) {
  const valores = normalizarDados(dados);
  const [resultadoInsert] = await conexao.execute(
    `INSERT INTO auditorias (usuario_id, acao, entidade, entidade_id, resultado, detalhes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    valores,
  );
  return {
    id: resultadoInsert.insertId,
    acao: valores[1],
    resultado: valores[4],
  };
}

async function registrar(dados = {}) {
  const valores = normalizarDados(dados);
  const resultadoInsert = await executarQuery(
    `INSERT INTO auditorias (usuario_id, acao, entidade, entidade_id, resultado, detalhes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    valores,
  );
  return {
    id: resultadoInsert.insertId,
    acao: valores[1],
    resultado: valores[4],
  };
}

async function buscarAuditorias({
  periodoInicio = null,
  periodoFim = null,
  resultado = "",
  acao = "",
  busca = "",
  limite = 100,
} = {}) {
  const where = [];
  const valores = [];
  if (periodoInicio) {
    where.push("a.criado_em >= ?");
    valores.push(periodoInicio);
  }
  if (periodoFim) {
    where.push("a.criado_em < ?");
    valores.push(periodoFim);
  }
  if (resultado) {
    where.push("a.resultado = ?");
    valores.push(resultado);
  }
  if (acao) {
    where.push("a.acao = ?");
    valores.push(acao);
  }
  if (busca) {
    where.push(
      "(a.acao LIKE ? OR a.entidade LIKE ? OR u.nome LIKE ? OR a.detalhes LIKE ?)",
    );
    const termo = `%${busca}%`;
    valores.push(termo, termo, termo, termo);
  }
  const clausula = where.length ? `WHERE ${where.join(" AND ")}` : "";
  valores.push(Number(limite));
  return executarQuery(
    `
    SELECT a.id, a.criado_em AS criadoEm, a.acao, a.entidade,
      a.entidade_id AS entidadeId, a.resultado, a.detalhes,
      u.id AS usuarioId, COALESCE(u.nome, 'Sistema') AS usuario,
      COALESCE(p.nome, 'SISTEMA') AS perfil
    FROM auditorias a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    LEFT JOIN perfis p ON p.id = u.perfil_id
    ${clausula}
    ORDER BY a.criado_em DESC, a.id DESC
    LIMIT ?`,
    valores,
  );
}

async function listarAcoes() {
  return executarQuery(
    "SELECT DISTINCT acao FROM auditorias WHERE acao IS NOT NULL AND TRIM(acao) <> '' ORDER BY acao ASC",
  );
}

async function contarResumo({ periodoInicio = null, periodoFim = null } = {}) {
  const where = [];
  const valores = [];
  if (periodoInicio) {
    where.push("criado_em >= ?");
    valores.push(periodoInicio);
  }
  if (periodoFim) {
    where.push("criado_em < ?");
    valores.push(periodoFim);
  }
  const clausula = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [resultado] = await executarQuery(
    `
    SELECT COUNT(*) AS total,
      SUM(resultado = 'SUCESSO') AS sucessos,
      SUM(resultado = 'FALHA') AS falhas,
      COUNT(DISTINCT usuario_id) AS usuarios
    FROM auditorias ${clausula}`,
    valores,
  );
  return resultado;
}

module.exports = {
  registrar,
  registrarNaConexao,
  buscarAuditorias,
  listarAcoes,
  contarResumo,
};
