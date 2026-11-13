const { executarQuery, executarTransacao } = require('../config/database');
const auditoriaRepository = require('./auditoriaRepository');

async function buscarCategorias() {
  return executarQuery(`
    SELECT id, nome
    FROM categorias
    WHERE ativo = TRUE
    ORDER BY nome ASC
  `);
}

async function buscarProdutos({ busca = '', categoriaId = null, pagina = 1, limite = 20 } = {}) {
  const valores = [];
  const filtros = ['p.ativo = TRUE'];

  if (busca) {
    const termo = `%${busca}%`;
    filtros.push("(p.nome ILIKE ? OR p.codigo ILIKE ? OR COALESCE(p.descricao, '') ILIKE ?)");
    valores.push(termo, termo, termo);
  }

  if (categoriaId !== null) {
    filtros.push('p.categoria_id = ?');
    valores.push(categoriaId);
  }

  const offset = (pagina - 1) * limite;

  // Count total
  const [countResult] = await executarQuery(
    `
    SELECT COUNT(DISTINCT p.id) AS total
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE ${filtros.join(' AND ')}
  `,
    valores
  );

  const total = Number(countResult?.total || 0);

  const produtos = await executarQuery(
    `
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
    LEFT JOIN lotes l
      ON l.produto_id = p.id
     AND l.ativo = TRUE
     AND (
       l.data_validade >= CURRENT_DATE
       OR (l.data_validade IS NULL AND p.possui_validade = FALSE)
     )
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
    ORDER BY p.criado_em DESC, p.id DESC
    LIMIT ? OFFSET ?
  `,
    [...valores, Number(limite), Number(offset)]
  );

  return { dados: produtos, total, pagina, limite, totalPaginas: Math.ceil(total / limite) };
}

async function buscarCategoriaAtiva(categoriaId) {
  const categorias = await executarQuery(
    `
    SELECT id, nome
    FROM categorias
    WHERE id = ? AND ativo = TRUE
    LIMIT 1
  `,
    [categoriaId]
  );

  return categorias[0] || null;
}

async function criarProduto({
  codigo,
  nome,
  descricao,
  categoriaId,
  estoqueMinimo,
  unidade,
  possuiValidade,
}) {
  const resultado = await executarQuery(
    `
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
    RETURNING id
  `,
    [codigo, nome, descricao, categoriaId, estoqueMinimo, unidade, possuiValidade]
  );

  return resultado[0].id;
}

async function buscarProdutoPorId(id) {
  const produtos = await executarQuery(
    `
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
    LEFT JOIN lotes l
      ON l.produto_id = p.id
     AND l.ativo = TRUE
     AND (
       l.data_validade >= CURRENT_DATE
       OR (l.data_validade IS NULL AND p.possui_validade = FALSE)
     )
    WHERE p.id = ? AND p.ativo = TRUE
    GROUP BY p.id, p.codigo, p.nome, p.descricao, p.categoria_id, c.nome,
      p.estoque_minimo, p.unidade, p.possui_validade, p.criado_em, p.atualizado_em
    LIMIT 1
  `,
    [id]
  );

  return produtos[0] || null;
}

async function atualizarProduto(id, campos) {
  const permitidos = {
    codigo: 'codigo',
    nome: 'nome',
    descricao: 'descricao',
    categoriaId: 'categoria_id',
    estoqueMinimo: 'estoque_minimo',
    unidade: 'unidade',
    possuiValidade: 'possui_validade',
  };

  const partes = [];
  const valores = [];
  for (const [chave, coluna] of Object.entries(permitidos)) {
    if (Object.prototype.hasOwnProperty.call(campos, chave)) {
      partes.push(`${coluna} = ?`);
      valores.push(campos[chave] === '' ? null : campos[chave]);
    }
  }

  if (!partes.length) {
    return buscarProdutoPorId(id);
  }

  valores.push(id);
  await executarQuery(
    `UPDATE produtos SET ${partes.join(', ')}, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND ativo = TRUE`,
    valores
  );
  return buscarProdutoPorId(id);
}

async function desativarProduto(id, usuarioId) {
  return executarTransacao(async (conexao) => {
    const [produtos] = await conexao.execute(
      'SELECT id, codigo, nome FROM produtos WHERE id = ? AND ativo = TRUE FOR UPDATE',
      [id]
    );
    if (!produtos.length) {
      return false;
    }

    const [lotes] = await conexao.execute(
      'SELECT id FROM lotes WHERE produto_id = ? AND ativo = TRUE AND quantidade_atual > 0 LIMIT 1',
      [id]
    );
    if (lotes.length) {
      const erro = new Error(
        'Não é possível desativar o produto enquanto houver saldo em lotes ativos. Ajuste ou descarte o estoque primeiro.'
      );
      erro.statusCode = 409;
      erro.codigo = 'PRODUTO_COM_ESTOQUE';
      throw erro;
    }

    const [atualizados] = await conexao.execute(
      'UPDATE produtos SET ativo = FALSE, atualizado_em = CURRENT_TIMESTAMP WHERE id = ? AND ativo = TRUE RETURNING id',
      [id]
    );
    if (!atualizados.length) {
      return false;
    }

    await auditoriaRepository.registrarNaConexao(conexao, {
      usuarioId,
      acao: 'PRODUTO_INATIVADO',
      entidade: 'PRODUTO',
      entidadeId: id,
      detalhes: {
        codigo: produtos[0].codigo,
        nome: produtos[0].nome,
      },
    });
    return true;
  });
}

module.exports = {
  buscarCategorias,
  buscarProdutos,
  buscarCategoriaAtiva,
  criarProduto,
  buscarProdutoPorId,
  atualizarProduto,
  desativarProduto,
};
