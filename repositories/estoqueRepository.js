// repositories/estoqueRepository.js
// somente consultas ao banco.
// regras de negocio ficam no estoqueService.

const db = require("../config/database");

// -------------------------------------------
// LISTAR ESTOQUE
// -------------------------------------------
// Soma a quantidade de todos os lotes de cada produto.
async function listarEstoque(filtros = {}) {
  let sql = `
        SELECT
            p.id,
            p.codigo_interno,
            p.nome,
            p.marca,
            p.faixa_etaria,
            p.tamanho,
            p.especial,
            c.nome AS categoria,
            COALESCE(SUM(l.quantidade), 0) AS quantidade_estoque
        FROM produtos p
        LEFT JOIN categorias c
            ON c.id = p.categoria_id
        LEFT JOIN lotes l
            ON l.produto_id = p.id
        WHERE p.ativo = TRUE
    `;

  const valores = [];

  if (filtros.codigo) {
    sql += ` AND p.codigo_interno LIKE ?`;
    valores.push(`%${filtros.codigo}%`);
  }

  if (filtros.nome) {
    sql += ` AND p.nome LIKE ?`;
    valores.push(`%${filtros.nome}%`);
  }

  if (filtros.categoria_id) {
    sql += ` AND p.categoria_id = ?`;
    valores.push(filtros.categoria_id);
  }

  sql += `
        GROUP BY
            p.id,
            p.codigo_interno,
            p.nome,
            p.marca,
            p.faixa_etaria,
            p.tamanho,
            p.especial,
            c.nome
        ORDER BY p.nome ASC
    `;

  const [linhas] = await db.query(sql, valores);

  return linhas;
}

// -------------------------------------------
// BUSCAR ESTOQUE DE UM PRODUTO
// -------------------------------------------
async function buscarEstoquePorProduto(produtoId) {
  const [linhas] = await db.query(
    `
        SELECT
            p.id,
            p.codigo_interno,
            p.nome,
            p.marca,
            p.especial,
            COALESCE(SUM(l.quantidade), 0) AS quantidade_estoque
        FROM produtos p
        LEFT JOIN lotes l
            ON l.produto_id = p.id
        WHERE p.id = ?
          AND p.ativo = TRUE
        GROUP BY
            p.id,
            p.codigo_interno,
            p.nome,
            p.marca,
            p.especial
        `,
    [produtoId],
  );

  return linhas[0] || null;
}

// -------------------------------------------
// LISTAR LOTES DE UM PRODUTO
// -------------------------------------------
async function listarLotesPorProduto(produtoId) {
  const [linhas] = await db.query(
    `
        SELECT
            l.id,
            l.produto_id,
            l.localizacao_id,
            l.quantidade,
            l.data_entrada,
            l.data_validade,
            loc.corredor,
            loc.prateleira,
            loc.nivel,
            loc.descricao AS localizacao_descricao
        FROM lotes l
        LEFT JOIN localizacoes loc
            ON loc.id = l.localizacao_id
        WHERE l.produto_id = ?
        ORDER BY l.data_entrada ASC, l.id ASC
        `,
    [produtoId],
  );

  return linhas;
}

// -------------------------------------------
// LOTES PRÓXIMOS DO VENCIMENTO
// -------------------------------------------
async function listarProximosDoVencimento(dias = 30) {
  const [linhas] = await db.query(
    `
        SELECT
            l.id AS lote_id,
            p.id AS produto_id,
            p.codigo_interno,
            p.nome,
            p.marca,
            l.quantidade,
            l.data_entrada,
            l.data_validade,
            DATEDIFF(l.data_validade, CURDATE()) AS dias_para_vencer
        FROM lotes l
        INNER JOIN produtos p
            ON p.id = l.produto_id
        WHERE p.ativo = TRUE
          AND l.quantidade > 0
          AND l.data_validade IS NOT NULL
          AND l.data_validade BETWEEN CURDATE()
              AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        ORDER BY l.data_validade ASC
        `,
    [dias],
  );

  return linhas;
}

// -------------------------------------------
// LOTES VENCIDOS
// -------------------------------------------
async function listarVencidos() {
  const [linhas] = await db.query(
    `
        SELECT
            l.id AS lote_id,
            p.id AS produto_id,
            p.codigo_interno,
            p.nome,
            p.marca,
            l.quantidade,
            l.data_entrada,
            l.data_validade
        FROM lotes l
        INNER JOIN produtos p
            ON p.id = l.produto_id
        WHERE p.ativo = TRUE
          AND l.quantidade > 0
          AND l.data_validade IS NOT NULL
          AND l.data_validade < CURDATE()
        ORDER BY l.data_validade ASC
        `,
  );

  return linhas;
}

// -------------------------------------------
// FIFO
// -------------------------------------------
// Retorna os lotes mais antigos primeiro.
async function listarFIFO(produtoId) {
  const [linhas] = await db.query(
    `
        SELECT
            l.id AS lote_id,
            l.produto_id,
            l.quantidade,
            l.data_entrada,
            l.data_validade,
            loc.corredor,
            loc.prateleira,
            loc.nivel
        FROM lotes l
        LEFT JOIN localizacoes loc
            ON loc.id = l.localizacao_id
        WHERE l.produto_id = ?
          AND l.quantidade > 0
        ORDER BY l.data_entrada ASC, l.id ASC
        `,
    [produtoId],
  );

  return linhas;
}

// -------------------------------------------
// PRODUTOS ESPECIAIS
// -------------------------------------------
async function listarProdutosEspeciais() {
  const [linhas] = await db.query(
    `
        SELECT
            p.id,
            p.codigo_interno,
            p.nome,
            p.marca,
            p.faixa_etaria,
            p.tamanho,
            p.especial,
            c.nome AS categoria,
            COALESCE(SUM(l.quantidade), 0) AS quantidade_estoque
        FROM produtos p
        LEFT JOIN categorias c
            ON c.id = p.categoria_id
        LEFT JOIN lotes l
            ON l.produto_id = p.id
        WHERE p.ativo = TRUE
          AND p.especial = TRUE
        GROUP BY
            p.id,
            p.codigo_interno,
            p.nome,
            p.marca,
            p.faixa_etaria,
            p.tamanho,
            p.especial,
            c.nome
        ORDER BY p.nome ASC
        `,
  );

  return linhas;
}

module.exports = {
  listarEstoque,
  buscarEstoquePorProduto,
  listarLotesPorProduto,
  listarProximosDoVencimento,
  listarVencidos,
  listarFIFO,
  listarProdutosEspeciais,
};
