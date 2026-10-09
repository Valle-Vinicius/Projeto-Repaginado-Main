const { executarQuery } = require('../config/database');

function montarFiltro({ inicio, fim, tipo = '', categoriaId = '', produtoId = '' } = {}) {
  const where = ["m.status = 'CONFIRMADA'"];
  const valores = [];
  if (inicio) { where.push('m.criado_em >= ?'); valores.push(inicio); }
  if (fim) { where.push('m.criado_em < ?'); valores.push(fim); }
  if (tipo) { where.push('m.tipo = ?'); valores.push(tipo); }
  if (categoriaId) { where.push('p.categoria_id = ?'); valores.push(Number(categoriaId)); }
  if (produtoId) { where.push('m.produto_id = ?'); valores.push(Number(produtoId)); }
  return { clausula: where.join(' AND '), valores };
}

async function buscarFiltros() {
  const [categorias, produtos] = await Promise.all([
    executarQuery('SELECT id, nome FROM categorias WHERE ativo = TRUE ORDER BY nome ASC'),
    executarQuery('SELECT id, nome, codigo FROM produtos WHERE ativo = TRUE ORDER BY nome ASC')
  ]);
  return { categorias, produtos };
}

async function buscarResumo(filtro) {
  const { clausula, valores } = montarFiltro(filtro);
  const linhas = await executarQuery(`
    SELECT COUNT(*) AS movimentacoes,
      COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade ELSE 0 END), 0) AS saidas,
      COUNT(DISTINCT m.produto_id) AS produtosMovimentados
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    WHERE ${clausula}
  `, valores);
  return linhas[0] || {};
}

async function buscarSerie(filtro) {
  const { clausula, valores } = montarFiltro(filtro);
  return executarQuery(`
    SELECT DATE_FORMAT(m.criado_em, '%Y-%m-%d') AS data,
      COALESCE(SUM(CASE WHEN m.tipo = 'ENTRADA' THEN m.quantidade ELSE 0 END), 0) AS entradas,
      COALESCE(SUM(CASE WHEN m.tipo = 'SAIDA' THEN m.quantidade ELSE 0 END), 0) AS saidas
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    WHERE ${clausula}
    GROUP BY DATE_FORMAT(m.criado_em, '%Y-%m-%d')
    ORDER BY data ASC
  `, valores);
}

async function buscarPorCategoria(filtro) {
  const { clausula, valores } = montarFiltro(filtro);
  return executarQuery(`
    SELECT c.id, c.nome, COALESCE(SUM(m.quantidade), 0) AS quantidade
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    INNER JOIN categorias c ON c.id = p.categoria_id
    WHERE ${clausula}
    GROUP BY c.id, c.nome
    ORDER BY quantidade DESC, c.nome ASC
  `, valores);
}

async function buscarPorProduto(filtro) {
  const { clausula, valores } = montarFiltro(filtro);
  return executarQuery(`
    SELECT p.id AS produtoId, p.nome AS produto, p.codigo,
      COALESCE(SUM(m.quantidade), 0) AS quantidade
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    WHERE ${clausula}
    GROUP BY p.id, p.nome, p.codigo
    ORDER BY quantidade DESC, p.nome ASC
    LIMIT 50
  `, valores);
}

async function buscarHistorico(filtro, limite = 200) {
  const { clausula, valores } = montarFiltro(filtro);
  return executarQuery(`
    SELECT m.id, m.criado_em AS criadoEm, m.tipo, m.quantidade,
      p.nome AS produto, p.codigo,
      COALESCE(u.nome, 'Sistema') AS responsavel
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE ${clausula}
    ORDER BY m.criado_em DESC, m.id DESC
    LIMIT ?
  `, [...valores, Number(limite)]);
}

module.exports = {
  buscarFiltros,
  buscarResumo,
  buscarSerie,
  buscarPorCategoria,
  buscarPorProduto,
  buscarHistorico
};
