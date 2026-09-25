const { executarQuery } = require('../config/database');

const EXPRESSOES_INICIO_PERIODO = Object.freeze({
  hoje: 'CURDATE()',
  '7d': 'DATE_SUB(CURDATE(), INTERVAL 6 DAY)',
  '30d': 'DATE_SUB(CURDATE(), INTERVAL 29 DAY)',
  mes: "DATE_FORMAT(CURDATE(), '%Y-%m-01')"
});

function obterInicioPeriodo(periodo) {
  const inicio = EXPRESSOES_INICIO_PERIODO[periodo];
  if (!inicio) throw new Error('Período de dashboard não permitido.');
  return inicio;
}

async function buscarResumo() {
  const [resumo] = await executarQuery(`
    SELECT
      COUNT(*) AS totalProdutos,
      COUNT(*) AS produtosAtivos,
      COALESCE(SUM(posicao.estoqueAtual), 0) AS estoqueTotal,
      COALESCE(SUM(CASE
        WHEN posicao.estoqueAtual > 0
         AND posicao.estoqueAtual <= posicao.estoqueMinimo
        THEN 1 ELSE 0 END), 0) AS estoqueBaixo,
      COALESCE(SUM(CASE WHEN posicao.estoqueAtual = 0 THEN 1 ELSE 0 END), 0) AS semEstoque
    FROM (
      SELECT
        p.id,
        p.estoque_minimo AS estoqueMinimo,
        COALESCE(SUM(CASE
          WHEN l.ativo = TRUE THEN l.quantidade_atual
          ELSE 0
        END), 0) AS estoqueAtual
      FROM produtos p
      LEFT JOIN lotes l ON l.produto_id = p.id
      WHERE p.ativo = TRUE
      GROUP BY p.id, p.estoque_minimo
    ) posicao
  `);

  return resumo || {
    totalProdutos: 0,
    produtosAtivos: 0,
    estoqueTotal: 0,
    estoqueBaixo: 0,
    semEstoque: 0
  };
}

async function buscarResumoMovimentacoes(periodo) {
  const inicio = obterInicioPeriodo(periodo);
  const [resumo] = await executarQuery(`
    SELECT
      COUNT(*) AS movimentacoesPeriodo,
      COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade ELSE 0 END), 0) AS entradasPeriodo,
      COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE 0 END), 0) AS saidasPeriodo
    FROM movimentacoes
    WHERE status = 'CONFIRMADA'
      AND criado_em >= ${inicio}
      AND criado_em < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
  `);

  return resumo || {
    movimentacoesPeriodo: 0,
    entradasPeriodo: 0,
    saidasPeriodo: 0
  };
}

async function buscarEstoqueBaixo() {
  return executarQuery(`
    SELECT
      p.id,
      p.codigo,
      p.nome,
      p.estoque_minimo AS estoqueMinimo,
      COALESCE(SUM(CASE
        WHEN l.ativo = TRUE THEN l.quantidade_atual
        ELSE 0
      END), 0) AS estoqueAtual,
      'ESTOQUE_BAIXO' AS status
    FROM produtos p
    LEFT JOIN lotes l ON l.produto_id = p.id
    WHERE p.ativo = TRUE
    GROUP BY p.id, p.codigo, p.nome, p.estoque_minimo
    HAVING estoqueAtual > 0
       AND estoqueAtual <= p.estoque_minimo
    ORDER BY estoqueAtual ASC, p.nome ASC
    LIMIT 10
  `);
}

async function buscarSemEstoque() {
  return executarQuery(`
    SELECT
      p.id,
      p.codigo,
      p.nome,
      p.estoque_minimo AS estoqueMinimo,
      0 AS estoqueAtual,
      'SEM_ESTOQUE' AS status
    FROM produtos p
    LEFT JOIN lotes l
      ON l.produto_id = p.id
     AND l.ativo = TRUE
    WHERE p.ativo = TRUE
    GROUP BY p.id, p.codigo, p.nome, p.estoque_minimo
    HAVING COALESCE(SUM(l.quantidade_atual), 0) = 0
    ORDER BY p.nome ASC
    LIMIT 10
  `);
}

async function buscarValidadesProximas(dias = 30) {
  const diasNumeros = Number(dias);
  if (!Number.isInteger(diasNumeros) || diasNumeros < 1 || diasNumeros > 365) {
    throw new Error('Janela de validade inválida.');
  }

  return executarQuery(`
    SELECT
      l.id AS loteId,
      p.id AS produtoId,
      p.codigo,
      p.nome,
      l.numero_lote AS numeroLote,
      l.quantidade_atual AS quantidadeAtual,
      l.data_validade AS dataValidade,
      DATEDIFF(l.data_validade, CURDATE()) AS diasParaVencer,
      CASE
        WHEN DATEDIFF(l.data_validade, CURDATE()) <= 7 THEN 'CRITICO'
        ELSE 'ATENCAO'
      END AS status
    FROM lotes l
    INNER JOIN produtos p ON p.id = l.produto_id
    WHERE l.ativo = TRUE
      AND p.ativo = TRUE
      AND l.quantidade_atual > 0
      AND l.data_validade IS NOT NULL
      AND l.data_validade >= CURDATE()
      AND l.data_validade <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ORDER BY l.data_validade ASC, l.id ASC
    LIMIT 10
  `, [diasNumeros]);
}

async function buscarVencidos() {
  return executarQuery(`
    SELECT
      l.id AS loteId,
      p.id AS produtoId,
      p.codigo,
      p.nome,
      l.numero_lote AS numeroLote,
      l.quantidade_atual AS quantidadeAtual,
      l.data_validade AS dataValidade,
      DATEDIFF(l.data_validade, CURDATE()) AS diasParaVencer,
      'VENCIDO' AS status
    FROM lotes l
    INNER JOIN produtos p ON p.id = l.produto_id
    WHERE l.ativo = TRUE
      AND p.ativo = TRUE
      AND l.quantidade_atual > 0
      AND l.data_validade IS NOT NULL
      AND l.data_validade < CURDATE()
    ORDER BY l.data_validade ASC, l.id ASC
    LIMIT 10
  `);
}

async function buscarMovimentacoes(periodo) {
  const inicio = obterInicioPeriodo(periodo);

  return executarQuery(`
    SELECT
      DATE(criado_em) AS data,
      COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE 0 END), 0) AS saidas
    FROM movimentacoes
    WHERE status = 'CONFIRMADA'
      AND criado_em >= ${inicio}
      AND criado_em < DATE_ADD(CURDATE(), INTERVAL 1 DAY)
    GROUP BY DATE(criado_em)
    ORDER BY data ASC
  `);
}

async function buscarCategorias(limite = 5) {
  return executarQuery(`
    SELECT
      COALESCE(c.nome, 'Sem categoria') AS nome,
      COUNT(DISTINCT p.id) AS total
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = TRUE
    GROUP BY c.id, c.nome
    ORDER BY total DESC, nome ASC
    LIMIT ?
  `, [limite]);
}

async function buscarAtividadesRecentes(limite = 8) {
  return executarQuery(`
    SELECT
      m.id,
      m.tipo,
      m.quantidade,
      m.status,
      m.observacao,
      m.criado_em AS criadoEm,
      p.id AS produtoId,
      p.nome AS produto,
      u.id AS usuarioId,
      COALESCE(u.nome, 'Usuário removido') AS usuario
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.status = 'CONFIRMADA'
    ORDER BY m.criado_em DESC, m.id DESC
    LIMIT ?
  `, [limite]);
}

module.exports = {
  buscarResumo,
  buscarResumoMovimentacoes,
  buscarEstoqueBaixo,
  buscarSemEstoque,
  buscarValidadesProximas,
  buscarVencidos,
  buscarMovimentacoes,
  buscarCategorias,
  buscarAtividadesRecentes,
  obterInicioPeriodo
};
