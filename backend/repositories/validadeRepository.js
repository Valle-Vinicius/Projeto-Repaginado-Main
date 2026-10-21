const { executarQuery } = require("../config/database");

function filtrosSql(status, busca) {
  const where = ["p.ativo = 1", "l.ativo = 1", "l.data_validade IS NOT NULL"];
  const valores = [];

  if (status === "VENCIDOS") {
    where.push("l.data_validade < CURDATE()");
  } else if (status === "CRITICO") {
    where.push("l.data_validade >= CURDATE()");
    where.push("DATEDIFF(l.data_validade, CURDATE()) <= 7");
  } else if (status === "ATENCAO") {
    where.push("l.data_validade >= CURDATE()");
    where.push("DATEDIFF(l.data_validade, CURDATE()) BETWEEN 8 AND 30");
  } else if (status === "NORMAL") {
    where.push("DATEDIFF(l.data_validade, CURDATE()) > 30");
  }

  if (busca) {
    where.push(
      "(p.nome LIKE ? OR p.codigo LIKE ? OR l.numero_lote LIKE ? OR l.fornecedor LIKE ?)",
    );
    const termo = `%${busca}%`;
    valores.push(termo, termo, termo, termo);
  }

  return { where: where.join(" AND "), valores };
}

async function listarValidades({ status = "TODOS", busca = "", limite = 200 }) {
  const filtros = filtrosSql(status, busca);
  const sql = `
    SELECT
      l.id,
      p.id AS produtoId,
      p.nome AS produto,
      p.codigo,
      c.nome AS categoria,
      l.numero_lote AS numeroLote,
      l.fornecedor,
      l.documento,
      DATE_FORMAT(l.data_validade, '%Y-%m-%d') AS dataValidade,
      DATEDIFF(l.data_validade, CURDATE()) AS diasRestantes,
      l.quantidade_atual AS quantidadeAtual,
      p.unidade,
      loc.nome AS localizacao,
      CASE
        WHEN l.data_validade < CURDATE() THEN 'VENCIDO'
        WHEN DATEDIFF(l.data_validade, CURDATE()) <= 7 THEN 'CRITICO'
        WHEN DATEDIFF(l.data_validade, CURDATE()) <= 30 THEN 'ATENCAO'
        ELSE 'NORMAL'
      END AS status
    FROM lotes l
    INNER JOIN produtos p ON p.id = l.produto_id
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN localizacoes loc ON loc.id = l.localizacao_id
    WHERE ${filtros.where}
    ORDER BY l.data_validade ASC, l.criado_em ASC
    LIMIT ?
  `;

  return executarQuery(sql, [...filtros.valores, Number(limite)]);
}

async function obterResumo() {
  const [resumo] = await executarQuery(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN l.data_validade < CURDATE() THEN 1 ELSE 0 END) AS vencidos,
      SUM(CASE WHEN l.data_validade >= CURDATE() AND DATEDIFF(l.data_validade, CURDATE()) <= 7 THEN 1 ELSE 0 END) AS criticos,
      SUM(CASE WHEN DATEDIFF(l.data_validade, CURDATE()) BETWEEN 8 AND 30 THEN 1 ELSE 0 END) AS atencao,
      SUM(CASE WHEN DATEDIFF(l.data_validade, CURDATE()) > 30 THEN 1 ELSE 0 END) AS normais
    FROM lotes l
    INNER JOIN produtos p ON p.id = l.produto_id
    WHERE p.ativo = 1 AND l.ativo = 1 AND l.data_validade IS NOT NULL
  `);

  return {
    total: Number(resumo?.total || 0),
    vencidos: Number(resumo?.vencidos || 0),
    criticos: Number(resumo?.criticos || 0),
    atencao: Number(resumo?.atencao || 0),
    normais: Number(resumo?.normais || 0),
  };
}

module.exports = { listarValidades, obterResumo };
