const { executarQuery, executarTransacao } = require("../config/database");

async function buscarProdutosComSaldo() {
  return executarQuery(`
    SELECT p.id, p.codigo, p.nome, p.unidade,
      p.estoque_minimo AS estoqueMinimo,
      p.possui_validade AS possuiValidade,
      c.id AS categoriaId,
      c.nome AS categoria,
      COALESCE((SELECT SUM(l2.quantidade_atual) FROM lotes l2 WHERE l2.produto_id = p.id AND l2.ativo = TRUE), 0) AS estoqueAtual,
      MAX(m.criado_em) AS ultimaMovimentacao
    FROM produtos p
    INNER JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN movimentacoes m ON m.produto_id = p.id AND m.status = 'CONFIRMADA'
    WHERE p.ativo = TRUE
    GROUP BY p.id, p.codigo, p.nome, p.unidade, p.estoque_minimo, p.possui_validade, c.id, c.nome
    ORDER BY p.nome ASC
  `);
}

async function buscarExpedicoes({ limite = 500 } = {}) {
  return executarQuery(
    `
    SELECT m.id, m.criado_em AS criadoEm, p.id AS produtoId,
      p.nome AS produto, p.codigo, l.numero_lote AS numeroLote,
      m.quantidade, m.destinatario, m.destino, m.documento,
      COALESCE(u.nome, 'Sistema') AS responsavel, m.observacao
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN lotes l ON l.id = m.lote_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.tipo = 'SAIDA' AND m.status = 'CONFIRMADA'
    ORDER BY m.criado_em DESC, m.id DESC
    LIMIT ?
  `,
    [Number(limite)],
  );
}

async function buscarRecebimentos({ limite = 500 } = {}) {
  return executarQuery(
    `
    SELECT m.id, m.criado_em AS criadoEm, p.id AS produtoId,
      p.nome AS produto, p.codigo, l.numero_lote AS numeroLote,
      l.fornecedor, l.documento, l.data_validade AS dataValidade,
      l.quantidade_atual AS saldoLote, loc.nome AS localizacao,
      m.quantidade, COALESCE(u.nome, 'Sistema') AS responsavel,
      m.observacao
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN lotes l ON l.id = m.lote_id
    LEFT JOIN localizacoes loc ON loc.id = l.localizacao_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.tipo = 'ENTRADA' AND m.status = 'CONFIRMADA'
    ORDER BY m.criado_em DESC, m.id DESC
    LIMIT ?
  `,
    [Number(limite)],
  );
}

async function buscarCategorias() {
  return executarQuery(
    "SELECT id, nome FROM categorias WHERE ativo = TRUE ORDER BY nome ASC",
  );
}

async function buscarLocalizacoes() {
  return executarQuery(
    "SELECT id, nome FROM localizacoes WHERE ativo = TRUE ORDER BY nome ASC",
  );
}

async function buscarMovimentacoes({ limite = 200 } = {}) {
  return executarQuery(
    `
    SELECT m.id, m.criado_em AS data, m.tipo, m.quantidade,
      p.nome AS produto, COALESCE(u.nome, 'Sistema') AS responsavel,
      m.observacao
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.status = 'CONFIRMADA'
    ORDER BY m.criado_em DESC, m.id DESC
    LIMIT ?
  `,
    [Number(limite)],
  );
}

async function buscarProdutoComLotes(conexao, produtoId) {
  const [produtos] = await conexao.execute(
    "SELECT id, nome, codigo, unidade FROM produtos WHERE id = ? AND ativo = TRUE FOR SHARE",
    [produtoId],
  );
  if (!produtos.length) return null;
  const [lotes] = await conexao.execute(
    `
    SELECT id, numero_lote, quantidade_atual
    FROM lotes
    WHERE produto_id = ? AND ativo = TRUE AND quantidade_atual > 0
    ORDER BY CASE WHEN data_validade IS NULL THEN 1 ELSE 0 END,
      data_validade ASC, criado_em ASC, id ASC
    FOR UPDATE
  `,
    [produtoId],
  );
  return { produto: produtos[0], lotes };
}

async function registrarSaida({
  produtoId,
  quantidade,
  usuarioId,
  destinatario,
  destino,
  documento,
  motivo,
  observacao,
  auditoriaRepository,
}) {
  return executarTransacao(async (conexao) => {
    const dados = await buscarProdutoComLotes(conexao, produtoId);
    if (!dados) {
      const erro = new Error("Produto não encontrado ou inativo.");
      erro.statusCode = 404;
      erro.codigo = "PRODUTO_NAO_ENCONTRADO";
      throw erro;
    }
    const saldoTotal = dados.lotes.reduce(
      (total, lote) => total + Number(lote.quantidade_atual),
      0,
    );
    if (saldoTotal < quantidade) {
      const erro = new Error(
        `Estoque insuficiente. Disponível: ${saldoTotal}.`,
      );
      erro.statusCode = 422;
      erro.codigo = "ESTOQUE_INSUFICIENTE";
      throw erro;
    }

    let restante = quantidade;
    const movimentacoes = [];
    for (const lote of dados.lotes) {
      if (restante <= 0) break;
      const retirada = Math.min(Number(lote.quantidade_atual), restante);
      await conexao.execute(
        "UPDATE lotes SET quantidade_atual = quantidade_atual - ? WHERE id = ?",
        [retirada, lote.id],
      );
      const [resultado] = await conexao.execute(
        `
        INSERT INTO movimentacoes
          (produto_id, lote_id, usuario_id, destinatario, destino, documento, tipo, quantidade, status, observacao)
        VALUES (?, ?, ?, ?, ?, ?, 'SAIDA', ?, 'CONFIRMADA', ?)
      `,
        [
          produtoId,
          lote.id,
          usuarioId || null,
          destinatario,
          destino,
          documento || null,
          retirada,
          observacao || motivo || null,
        ],
      );
      movimentacoes.push({
        id: resultado.insertId,
        loteId: lote.id,
        numeroLote: lote.numero_lote,
        quantidade: retirada,
      });
      restante -= retirada;
    }

    const auditoria = await auditoriaRepository.registrarNaConexao(conexao, {
      usuarioId,
      acao: "EXPEDICAO_CONFIRMADA",
      entidade: "MOVIMENTACAO",
      entidadeId: movimentacoes[0].id,
      resultado: "SUCESSO",
      detalhes: {
        produtoId,
        produto: dados.produto.nome,
        codigo: dados.produto.codigo,
        quantidade,
        destinatario,
        destino,
        documento: documento || null,
        movimentacoes,
      },
    });
    return { produto: dados.produto, quantidade, movimentacoes, auditoria };
  });
}

async function registrarEntrada({
  produtoId,
  quantidade,
  usuarioId,
  fornecedor,
  documento,
  numeroLote,
  dataValidade,
  localizacaoId,
  observacao,
  auditoriaRepository,
}) {
  return executarTransacao(async (conexao) => {
    const [produtos] = await conexao.execute(
      "SELECT id, nome, codigo, unidade FROM produtos WHERE id = ? AND ativo = TRUE FOR SHARE",
      [produtoId],
    );
    if (!produtos.length) {
      const erro = new Error("Produto não encontrado ou inativo.");
      erro.statusCode = 404;
      erro.codigo = "PRODUTO_NAO_ENCONTRADO";
      throw erro;
    }

    let loteId;
    if (numeroLote) {
      const [existentes] = await conexao.execute(
        "SELECT id FROM lotes WHERE produto_id = ? AND numero_lote = ? FOR UPDATE",
        [produtoId, numeroLote],
      );
      if (existentes.length) {
        loteId = existentes[0].id;
        await conexao.execute(
          `UPDATE lotes SET quantidade_atual = quantidade_atual + ?, fornecedor = COALESCE(?, fornecedor), documento = COALESCE(?, documento), data_validade = COALESCE(?, data_validade), localizacao_id = COALESCE(?, localizacao_id) WHERE id = ?`,
          [
            quantidade,
            fornecedor || null,
            documento || null,
            dataValidade || null,
            localizacaoId || null,
            loteId,
          ],
        );
      }
    }
    if (!loteId) {
      const [novoLote] = await conexao.execute(
        `
        INSERT INTO lotes (produto_id, numero_lote, fornecedor, documento, quantidade_atual, data_validade, localizacao_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
        [
          produtoId,
          numeroLote || `ENTRADA-${Date.now()}`,
          fornecedor || null,
          documento || null,
          quantidade,
          dataValidade || null,
          localizacaoId || null,
        ],
      );
      loteId = novoLote.insertId;
    }

    const [movimento] = await conexao.execute(
      `
      INSERT INTO movimentacoes (produto_id, lote_id, usuario_id, documento, tipo, quantidade, status, observacao)
      VALUES (?, ?, ?, ?, 'ENTRADA', ?, 'CONFIRMADA', ?)
    `,
      [
        produtoId,
        loteId,
        usuarioId || null,
        documento || null,
        quantidade,
        observacao || null,
      ],
    );

    const auditoria = await auditoriaRepository.registrarNaConexao(conexao, {
      usuarioId,
      acao: "RECEBIMENTO_CONFIRMADO",
      entidade: "MOVIMENTACAO",
      entidadeId: movimento.insertId,
      resultado: "SUCESSO",
      detalhes: {
        produtoId,
        produto: produtos[0].nome,
        codigo: produtos[0].codigo,
        quantidade,
        numeroLote: numeroLote || null,
        fornecedor: fornecedor || null,
        documento: documento || null,
      },
    });
    return {
      produto: produtos[0],
      quantidade,
      loteId,
      movimentacaoId: movimento.insertId,
      auditoria,
    };
  });
}

module.exports = {
  buscarProdutosComSaldo,
  buscarCategorias,
  buscarLocalizacoes,
  buscarMovimentacoes,
  buscarExpedicoes,
  buscarRecebimentos,
  registrarSaida,
  registrarEntrada,
};
