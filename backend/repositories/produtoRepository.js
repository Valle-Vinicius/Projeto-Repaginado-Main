const { executarQuery } = require('../config/database');

async function buscarCategorias() {
  return executarQuery(`
    SELECT id, nome
    FROM categorias
    WHERE ativo = TRUE
    ORDER BY nome ASC
  `);
}

async function buscarProdutos({ busca = '', categoriaId = null } = {}) {
  const valores = [];
  const filtros = ['p.ativo = TRUE'];

  if (busca) {
    const termo = `%${busca}%`;
    filtros.push('(p.nome LIKE ? OR p.codigo LIKE ? OR COALESCE(p.descricao, \'\') LIKE ?)');
    valores.push(termo, termo, termo);
  }

  if (categoriaId != null) {
    filtros.push('p.categoria_id = ?');
    valores.push(categoriaId);
  }

  return executarQuery(`
    SELECT
      p.id,
      p.codigo AS sku,
      p.nome,
      p.descricao,
      p.categoria_id AS categoriaId,
      COALESCE(c.nome, 'Sem categoria') AS categoria,
      p.estoque_minimo AS estoqueMinimo,
      p.unidade,
      p.possui_validade AS possuiValidade,
      COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) AS estoque,
      p.criado_em AS criadoEm,
      p.atualizado_em AS atualizadoEm,
      m.ultimaMovimentacao AS ultimaMovimentacao,
      CASE
        WHEN COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) = 0 THEN 'SEM_ESTOQUE'
        WHEN COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) <= p.estoque_minimo THEN 'BAIXO'
        ELSE 'NORMAL'
      END AS status,
      'ATIVO' AS statusProduto
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN lotes l ON l.produto_id = p.id
    LEFT JOIN (
      SELECT produto_id, MAX(criado_em) AS ultimaMovimentacao
      FROM movimentacoes
      WHERE status = 'CONFIRMADA'
      GROUP BY produto_id
    ) m ON m.produto_id = p.id
    WHERE ${filtros.join(' AND ')}
    GROUP BY p.id, p.codigo, p.nome, p.descricao, p.categoria_id, c.nome,
      p.estoque_minimo, p.unidade, p.possui_validade, p.criado_em, p.atualizado_em,
      m.ultimaMovimentacao
    ORDER BY p.nome ASC
  `, valores);
}

async function buscarCategoriaAtiva(categoriaId) {
  const categorias = await executarQuery(`
    SELECT id, nome
    FROM categorias
    WHERE id = ? AND ativo = TRUE
    LIMIT 1
  `, [categoriaId]);

  return categorias[0] || null;
}

async function criarProduto({
  codigo,
  nome,
  descricao,
  categoriaId,
  estoqueMinimo,
  unidade,
  possuiValidade
}) {
  const resultado = await executarQuery(`
    INSERT INTO produtos (
      codigo,
      nome,
      descricao,
      categoria_id,
      estoque_minimo,
      unidade,
      possui_validade,
      ativo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
  `, [
    codigo,
    nome,
    descricao,
    categoriaId,
    estoqueMinimo,
    unidade,
    possuiValidade
  ]);

  return resultado.insertId;
}

async function buscarProdutoPorId(id) {
  const produtos = await executarQuery(`
    SELECT
      p.id,
      p.codigo AS sku,
      p.nome,
      p.descricao,
      p.categoria_id AS categoriaId,
      COALESCE(c.nome, 'Sem categoria') AS categoria,
      p.estoque_minimo AS estoqueMinimo,
      p.unidade,
      p.possui_validade AS possuiValidade,
      COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) AS estoque,
      p.criado_em AS criadoEm,
      p.atualizado_em AS atualizadoEm,
      CASE
        WHEN COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) = 0 THEN 'SEM_ESTOQUE'
        WHEN COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) <= p.estoque_minimo THEN 'BAIXO'
        ELSE 'NORMAL'
      END AS status,
      'ATIVO' AS statusProduto
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN lotes l ON l.produto_id = p.id
    WHERE p.id = ? AND p.ativo = TRUE
    GROUP BY p.id, p.codigo, p.nome, p.descricao, p.categoria_id, c.nome,
      p.estoque_minimo, p.unidade, p.possui_validade, p.criado_em, p.atualizado_em
    LIMIT 1
  `, [id]);

  return produtos[0] || null;
}

module.exports = {
  buscarCategorias,
  buscarProdutos,
  buscarCategoriaAtiva,
  criarProduto,
  buscarProdutoPorId
};
