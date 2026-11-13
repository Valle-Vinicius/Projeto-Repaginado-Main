const { executarQuery } = require('../config/database');

const DIAS_POR_PERIODO = Object.freeze({
  hoje: 0,
  '7d': 6,
  '30d': 29,
});

function inicioDoDia(referencia) {
  const dia = new Date(referencia.getTime());
  dia.setHours(0, 0, 0, 0);
  return dia;
}

function obterIntervaloPeriodo(periodo) {
  const hoje = inicioDoDia(new Date());

  if (!Object.prototype.hasOwnProperty.call(DIAS_POR_PERIODO, periodo) && periodo !== 'mes') {
    throw new Error('Período de dashboard não permitido.');
  }

  const inicio = new Date(hoje.getTime());
  if (periodo === 'mes') {
    inicio.setDate(1);
  } else {
    inicio.setDate(inicio.getDate() - DIAS_POR_PERIODO[periodo]);
  }

  const fim = new Date(hoje.getTime());
  fim.setDate(fim.getDate() + 1);

  return { inicio, fim };
}

function obterIntervaloAnterior(periodo) {
  const atual = obterIntervaloPeriodo(periodo);
  if (periodo === 'mes') {
    const inicio = new Date(atual.inicio.getTime());
    inicio.setMonth(inicio.getMonth() - 1);
    return { inicio, fim: atual.inicio };
  }

  const duracao = atual.fim.getTime() - atual.inicio.getTime();
  return {
    inicio: new Date(atual.inicio.getTime() - duracao),
    fim: atual.inicio,
  };
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

  return (
    resumo || {
      totalProdutos: 0,
      produtosAtivos: 0,
      estoqueTotal: 0,
      estoqueBaixo: 0,
      semEstoque: 0,
    }
  );
}

async function buscarResumoMovimentacoes(periodo) {
  const atual = obterIntervaloPeriodo(periodo);
  const anterior = obterIntervaloAnterior(periodo);
  const [resumo] = await executarQuery(
    `
    SELECT
      COUNT(*) FILTER (WHERE criado_em >= ? AND criado_em < ?) AS movimentacoesPeriodo,
      COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'ENTRADA' AND criado_em >= ? AND criado_em < ?), 0) AS entradasPeriodo,
      COALESCE(SUM(quantidade) FILTER (WHERE tipo = 'SAIDA' AND criado_em >= ? AND criado_em < ?), 0) AS saidasPeriodo,
      COUNT(*) FILTER (WHERE criado_em >= ? AND criado_em < ?) AS movimentacoesPeriodoAnterior
    FROM movimentacoes
    WHERE status = 'CONFIRMADA'
      AND criado_em >= ?
      AND criado_em < ?
  `,
    [
      atual.inicio,
      atual.fim,
      atual.inicio,
      atual.fim,
      atual.inicio,
      atual.fim,
      anterior.inicio,
      anterior.fim,
      anterior.inicio,
      atual.fim,
    ]
  );

  return (
    resumo || {
      movimentacoesPeriodo: 0,
      entradasPeriodo: 0,
      saidasPeriodo: 0,
      movimentacoesPeriodoAnterior: 0,
    }
  );
}

async function buscarResumoValidades() {
  const [resumo] = await executarQuery(`
    SELECT
      COUNT(DISTINCT p.id) FILTER (
        WHERE l.data_validade >= CURRENT_DATE
          AND l.data_validade <= CURRENT_DATE + 7
      ) AS ate7Dias,
      COUNT(DISTINCT p.id) FILTER (
        WHERE l.data_validade >= CURRENT_DATE
          AND l.data_validade <= CURRENT_DATE + 30
      ) AS ate30Dias,
      COUNT(DISTINCT p.id) FILTER (
        WHERE l.data_validade > CURRENT_DATE + 7
          AND l.data_validade <= CURRENT_DATE + 30
      ) AS de8a30Dias,
      COUNT(DISTINCT p.id) FILTER (
        WHERE l.data_validade > CURRENT_DATE + 30
      ) AS acima30Dias,
      COUNT(DISTINCT p.id) FILTER (
        WHERE l.data_validade < CURRENT_DATE
      ) AS vencidos,
      COUNT(DISTINCT p.id) FILTER (
        WHERE l.data_validade <= CURRENT_DATE + 30
      ) AS produtosPendentes
    FROM lotes l
    INNER JOIN produtos p ON p.id = l.produto_id
    WHERE l.ativo = TRUE
      AND p.ativo = TRUE
      AND l.quantidade_atual > 0
      AND l.data_validade IS NOT NULL
  `);

  return resumo || {
    ate7Dias: 0,
    ate30Dias: 0,
    de8a30Dias: 0,
    acima30Dias: 0,
    vencidos: 0,
    produtosPendentes: 0,
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
    HAVING COALESCE(SUM(CASE
        WHEN l.ativo = TRUE THEN l.quantidade_atual
        ELSE 0
      END), 0) > 0
       AND COALESCE(SUM(CASE
        WHEN l.ativo = TRUE THEN l.quantidade_atual
        ELSE 0
      END), 0) <= p.estoque_minimo
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

  return executarQuery(
    `
    SELECT
      l.id AS loteId,
      p.id AS produtoId,
      p.codigo,
      p.nome,
      l.numero_lote AS numeroLote,
      l.quantidade_atual AS quantidadeAtual,
      TO_CHAR(l.data_validade, 'YYYY-MM-DD') AS dataValidade,
      (l.data_validade - CURRENT_DATE) AS diasParaVencer,
      CASE
        WHEN (l.data_validade - CURRENT_DATE) <= 7 THEN 'CRITICO'
        ELSE 'ATENCAO'
      END AS status
    FROM lotes l
    INNER JOIN produtos p ON p.id = l.produto_id
    WHERE l.ativo = TRUE
      AND p.ativo = TRUE
      AND l.quantidade_atual > 0
      AND l.data_validade IS NOT NULL
      AND l.data_validade >= CURRENT_DATE
      AND l.data_validade <= CURRENT_TIMESTAMP + (? * INTERVAL '1 day')
    ORDER BY l.data_validade ASC, l.id ASC
    LIMIT 10
  `,
    [diasNumeros]
  );
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
      TO_CHAR(l.data_validade, 'YYYY-MM-DD') AS dataValidade,
      (l.data_validade - CURRENT_DATE) AS diasParaVencer,
      'VENCIDO' AS status
    FROM lotes l
    INNER JOIN produtos p ON p.id = l.produto_id
    WHERE l.ativo = TRUE
      AND p.ativo = TRUE
      AND l.quantidade_atual > 0
      AND l.data_validade IS NOT NULL
      AND l.data_validade < CURRENT_DATE
    ORDER BY l.data_validade ASC, l.id ASC
    LIMIT 10
  `);
}

async function buscarMovimentacoes(periodo) {
  const { inicio, fim } = obterIntervaloPeriodo(periodo);

  return executarQuery(
    `
    SELECT
      DATE(criado_em) AS data,
      COALESCE(SUM(CASE WHEN tipo = 'ENTRADA' THEN quantidade ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN tipo = 'SAIDA' THEN quantidade ELSE 0 END), 0) AS saidas
    FROM movimentacoes
    WHERE status = 'CONFIRMADA'
      AND criado_em >= ?
      AND criado_em < ?
    GROUP BY DATE(criado_em)
    ORDER BY data ASC
  `,
    [inicio, fim]
  );
}

async function buscarCategorias(limite = 5) {
  return executarQuery(
    `
    SELECT
      COALESCE(c.nome, 'Sem categoria') AS nome,
      COUNT(DISTINCT p.id) AS total
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = TRUE
    GROUP BY c.id, c.nome
    ORDER BY total DESC, nome ASC
    LIMIT ?
  `,
    [limite]
  );
}

async function buscarAtividadesRecentes(periodo, limite = 8) {
  const { inicio, fim } = obterIntervaloPeriodo(periodo);
  return executarQuery(
    `
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
      AND m.criado_em >= ?
      AND m.criado_em < ?
    ORDER BY m.criado_em DESC, m.id DESC
    LIMIT ?
  `,
    [inicio, fim, limite]
  );
}

async function buscarProdutosMaisMovimentados(periodo, limite = 5) {
  const { inicio, fim } = obterIntervaloPeriodo(periodo);
  return executarQuery(
    `
    SELECT
      p.id,
      p.nome,
      COALESCE(SUM(ABS(m.quantidade)), 0) AS totalMovimentado,
      COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade ELSE 0 END), 0) AS saidas,
      COALESCE(SUM(CASE WHEN m.tipo = 'AJUSTE' THEN ABS(m.quantidade) ELSE 0 END), 0) AS ajustes
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    WHERE m.status = 'CONFIRMADA'
      AND m.criado_em >= ?
      AND m.criado_em < ?
    GROUP BY p.id, p.nome
    ORDER BY totalMovimentado DESC, p.nome ASC
    LIMIT ?
  `,
    [inicio, fim, limite]
  );
}

module.exports = {
  buscarResumo,
  buscarResumoMovimentacoes,
  buscarResumoValidades,
  buscarEstoqueBaixo,
  buscarSemEstoque,
  buscarValidadesProximas,
  buscarVencidos,
  buscarMovimentacoes,
  buscarCategorias,
  buscarAtividadesRecentes,
  buscarProdutosMaisMovimentados,
  obterIntervaloPeriodo,
  obterIntervaloAnterior,
};
