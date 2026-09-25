const { executarQuery, executarTransacao } = require('../config/database');

async function buscarCategorias() {
  return executarQuery(`
    SELECT id, nome
    FROM categorias
    WHERE ativo = TRUE
    ORDER BY nome ASC
  `);
}

async function buscarLocalizacoes() {
  return executarQuery(`
    SELECT id, nome, descricao
    FROM localizacoes
    WHERE ativo = TRUE
    ORDER BY nome ASC
  `);
}

async function buscarProdutos({ busca = '', categoriaId = null } = {}) {
  const parametros = [];
  const filtros = ['p.ativo = TRUE'];

  if (busca) {
    filtros.push('(p.nome LIKE ? OR p.codigo LIKE ? OR COALESCE(p.descricao, \'\') LIKE ?)');
    const termo = `%${busca}%`;
    parametros.push(termo, termo, termo);
  }

  if (categoriaId) {
    filtros.push('p.categoria_id = ?');
    parametros.push(categoriaId);
  }

  return executarQuery(`
    SELECT
      p.id,
      p.codigo,
      p.nome,
      p.descricao,
      p.categoria_id AS categoriaId,
      COALESCE(c.nome, 'Sem categoria') AS categoria,
      p.estoque_minimo AS estoqueMinimo,
      p.unidade,
      p.possui_validade AS possuiValidade,
      COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) AS estoque,
      MAX(ult.ultimaMovimentacao) AS ultimaMovimentacao,
      CASE
        WHEN COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) = 0 THEN 'SEM_ESTOQUE'
        WHEN COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) < p.estoque_minimo THEN 'BAIXO'
        ELSE 'NORMAL'
      END AS status
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN lotes l ON l.produto_id = p.id
    LEFT JOIN (
      SELECT produto_id, MAX(criado_em) AS ultimaMovimentacao
      FROM movimentacoes
      WHERE status = 'CONFIRMADA'
      GROUP BY produto_id
    ) ult ON ult.produto_id = p.id
    WHERE ${filtros.join(' AND ')}
      GROUP BY p.id, p.codigo, p.nome, p.descricao, p.categoria_id, c.nome, p.estoque_minimo, p.unidade, p.possui_validade

    ORDER BY p.nome ASC
  `, parametros);
}

async function buscarResumo() {
  const [resumo] = await executarQuery(`
    SELECT
      COUNT(*) AS totalProdutos,
      COALESCE(SUM(estoque), 0) AS estoqueTotal,
      COALESCE(SUM(CASE WHEN estoque > 0 AND estoque < estoqueMinimo THEN 1 ELSE 0 END), 0) AS estoqueBaixo,
      COALESCE(SUM(CASE WHEN estoque = 0 THEN 1 ELSE 0 END), 0) AS semEstoque
    FROM (
      SELECT
        p.id,
        p.estoque_minimo AS estoqueMinimo,
        COALESCE(SUM(CASE WHEN l.ativo = TRUE THEN l.quantidade_atual ELSE 0 END), 0) AS estoque
      FROM produtos p
      LEFT JOIN lotes l ON l.produto_id = p.id
      WHERE p.ativo = TRUE
      GROUP BY p.id, p.estoque_minimo
    ) posicao
  `);

  const [movimentacoes] = await executarQuery(`
    SELECT COUNT(*) AS movimentacoesHoje
    FROM movimentacoes
    WHERE status = 'CONFIRMADA'
      AND DATE(criado_em) = CURDATE()
  `);

  return {
    ...resumo,
    ...movimentacoes
  };
}

async function buscarMovimentacoes(limite = 20) {
  return executarQuery(`
    SELECT
      m.id,
      m.criado_em AS data,
      p.id AS produtoId,
      p.nome AS produto,
      m.tipo,
      m.quantidade,
      COALESCE(u.nome, 'Usuário removido') AS responsavel,
      m.observacao
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.status = 'CONFIRMADA'
    ORDER BY m.criado_em DESC, m.id DESC
    LIMIT ?
  `, [limite]);
}

async function buscarLotesDoProduto(conexao, produtoId) {
  const [lotes] = await conexao.execute(`
    SELECT id, produto_id AS produtoId, numero_lote AS numeroLote, quantidade_atual AS quantidadeAtual
    FROM lotes
    WHERE produto_id = ?
      AND ativo = TRUE
      AND quantidade_atual > 0
    ORDER BY criado_em ASC, id ASC
    FOR UPDATE
  `, [produtoId]);

  return lotes;
}

async function buscarProdutoAtivo(conexao, produtoId) {
  const [produtos] = await conexao.execute(`
    SELECT id, nome, estoque_minimo AS estoqueMinimo, possui_validade AS possuiValidade
    FROM produtos
    WHERE id = ?
      AND ativo = TRUE
    LIMIT 1
  `, [produtoId]);

  return produtos[0] || null;
}

async function buscarLoteDoProduto(conexao, produtoId, loteId) {
  const [lotes] = await conexao.execute(`
    SELECT id, produto_id AS produtoId, numero_lote AS numeroLote, quantidade_atual AS quantidadeAtual
    FROM lotes
    WHERE id = ?
      AND produto_id = ?
      AND ativo = TRUE
    LIMIT 1
    FOR UPDATE
  `, [loteId, produtoId]);

  return lotes[0] || null;
}

async function criarLote(conexao, { produtoId, numeroLote, fornecedor = null, documento = null, dataValidade = null, localizacaoId = null, quantidade }) {
  const [resultado] = await conexao.execute(`
    INSERT INTO lotes (
      produto_id,
      numero_lote,
      fornecedor,
      documento,
      quantidade_atual,
      data_validade,
      localizacao_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [produtoId, numeroLote, fornecedor, documento, quantidade, dataValidade, localizacaoId]);

  return resultado.insertId;
}

async function atualizarQuantidadeLote(conexao, loteId, quantidade) {
  await conexao.execute(`
    UPDATE lotes
    SET quantidade_atual = ?,
        ativo = CASE WHEN ? = 0 THEN FALSE ELSE ativo END
    WHERE id = ?
  `, [quantidade, quantidade, loteId]);
}

async function registrarMovimentacao(conexao, { produtoId, loteId, usuarioId, tipo, quantidade, destinatario, destino, documento, observacao }) {
  const [resultado] = await conexao.execute(`
    INSERT INTO movimentacoes (
      produto_id,
      lote_id,
      usuario_id,
      destinatario,
      destino,
      documento,
      tipo,
      quantidade,
      status,
      observacao
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMADA', ?)
  `, [produtoId, loteId, usuarioId || null, destinatario || null, destino || null, documento || null, tipo, quantidade, observacao || null]);

  return resultado.insertId;
}

async function buscarRecebimentos({ busca = '', limite = 100 } = {}) {
  const parametros = [];
  const filtros = ["m.tipo = 'ENTRADA'", "m.status = 'CONFIRMADA'"];
  const termo = String(busca || '').trim();

  if (termo) {
    filtros.push('(p.nome LIKE ? OR p.codigo LIKE ? OR l.numero_lote LIKE ? OR l.fornecedor LIKE ? OR l.documento LIKE ?)');
    const parametroBusca = `%${termo}%`;
    parametros.push(parametroBusca, parametroBusca, parametroBusca, parametroBusca, parametroBusca);
  }

  parametros.push(Math.min(Math.max(Number(limite) || 100, 1), 500));

  return executarQuery(`
    SELECT
      m.id,
      m.criado_em AS criadoEm,
      p.id AS produtoId,
      p.nome AS produto,
      p.codigo,
      l.numero_lote AS numeroLote,
      l.fornecedor,
      l.documento,
      l.data_validade AS dataValidade,
      l.quantidade_atual AS saldoLote,
      loc.nome AS localizacao,
      m.quantidade,
      u.nome AS responsavel,
      m.observacao
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN lotes l ON l.id = m.lote_id
    LEFT JOIN localizacoes loc ON loc.id = l.localizacao_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE ${filtros.join(' AND ')}
    ORDER BY m.criado_em DESC
    LIMIT ?
  `, parametros);
}

async function registrarEntrada({ produtoId, usuarioId, quantidade, loteId, numeroLote, fornecedor, documento, dataValidade, localizacaoId, observacao }) {
  return executarTransacao(async (conexao) => {
    const produto = await buscarProdutoAtivo(conexao, produtoId);
    if (!produto) {
      const erro = new Error('Produto ativo não encontrado.');
      erro.statusCode = 404;
      throw erro;
    }

    if (produto.possuiValidade && !dataValidade) {
      const erro = new Error('Informe a validade do lote para este produto.');
      erro.statusCode = 400;
      throw erro;
    }

    if (dataValidade && dataValidade < new Date().toISOString().slice(0, 10)) {
      const erro = new Error('A validade do lote não pode ser anterior à data de entrada.');
      erro.statusCode = 400;
      throw erro;
    }

    let lote;
    if (loteId) {
      lote = await buscarLoteDoProduto(conexao, produtoId, loteId);
      if (!lote) {
        const erro = new Error('Lote não encontrado para este produto.');
        erro.statusCode = 404;
        throw erro;
      }
      await atualizarQuantidadeLote(conexao, lote.id, Number(lote.quantidadeAtual) + quantidade);
    } else {
      const numeroLoteNormalizado = String(numeroLote || '').trim();
      if (!numeroLoteNormalizado) {
        const erro = new Error('O número do lote é obrigatório para registrar uma entrada.');
        erro.statusCode = 400;
        throw erro;
      }
      const novoLoteId = await criarLote(conexao, {
        produtoId,
        numeroLote: numeroLoteNormalizado,
        fornecedor,
        documento,
        dataValidade: produto.possuiValidade ? dataValidade : null,
        localizacaoId: localizacaoId || null,
        quantidade
      });
      lote = { id: novoLoteId };
    }

    const movimentacaoId = await registrarMovimentacao(conexao, {
      produtoId,
      loteId: lote.id,
      usuarioId,
      tipo: 'ENTRADA',
      quantidade,
      observacao
    });

    return { movimentacaoId, produtoId, loteId: lote.id };
  });
}

async function buscarExpedicoes({ busca = '', limite = 100 } = {}) {
  const parametros = [];
  const filtros = ["m.tipo = 'SAIDA'", "m.status = 'CONFIRMADA'"];
  const termo = String(busca || '').trim();
  if (termo) {
    filtros.push('(p.nome LIKE ? OR p.codigo LIKE ? OR m.destinatario LIKE ? OR m.destino LIKE ? OR m.documento LIKE ?)');
    const buscaSql = `%${termo}%`;
    parametros.push(buscaSql, buscaSql, buscaSql, buscaSql, buscaSql);
  }
  parametros.push(Math.min(Math.max(Number(limite) || 100, 1), 500));
  return executarQuery(`
    SELECT m.id, m.criado_em AS criadoEm, p.id AS produtoId, p.nome AS produto,
           p.codigo, l.numero_lote AS numeroLote, m.quantidade,
           m.destinatario, m.destino, m.documento, u.nome AS responsavel,
           m.observacao
    FROM movimentacoes m
    INNER JOIN produtos p ON p.id = m.produto_id
    LEFT JOIN lotes l ON l.id = m.lote_id
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    WHERE ${filtros.join(' AND ')}
    ORDER BY m.criado_em DESC
    LIMIT ?
  `, parametros);
}

async function registrarSaida({ produtoId, usuarioId, quantidade, loteId = null, destinatario, destino, documento, observacao }) {
  return executarTransacao(async (conexao) => {
    const produto = await buscarProdutoAtivo(conexao, produtoId);
    if (!produto) {
      const erro = new Error('Produto ativo não encontrado.');
      erro.statusCode = 404;
      throw erro;
    }

    const lotes = loteId
      ? [await buscarLoteDoProduto(conexao, produtoId, loteId)]
      : await buscarLotesDoProduto(conexao, produtoId);

    if (!lotes.length || !lotes[0]) {
      const erro = new Error('Não há estoque disponível para este produto.');
      erro.statusCode = 422;
      throw erro;
    }

    const estoqueDisponivel = lotes.reduce((total, lote) => total + Number(lote.quantidadeAtual), 0);
    if (estoqueDisponivel < quantidade) {
      const erro = new Error(`Estoque insuficiente. Disponível: ${estoqueDisponivel}.`);
      erro.statusCode = 422;
      throw erro;
    }

    let restante = quantidade;
    const movimentacoes = [];

    for (const lote of lotes) {
      if (restante <= 0) break;
      const quantidadeDoLote = Math.min(Number(lote.quantidadeAtual), restante);
      const saldoNovo = Number(lote.quantidadeAtual) - quantidadeDoLote;
      await atualizarQuantidadeLote(conexao, lote.id, saldoNovo);
      const movimentacaoId = await registrarMovimentacao(conexao, {
        produtoId,
        loteId: lote.id,
        usuarioId,
        tipo: 'SAIDA',
        quantidade: quantidadeDoLote,
        destinatario,
        destino,
        documento,
        observacao
      });
      movimentacoes.push({ movimentacaoId, loteId: lote.id, quantidade: quantidadeDoLote });
      restante -= quantidadeDoLote;
    }

    return { produtoId, quantidade, movimentacoes, regra: loteId ? 'LOTE_INFORMADO' : 'FIFO' };
  });
}

module.exports = {
  buscarCategorias,
  buscarLocalizacoes,
  buscarProdutos,
  buscarResumo,
  buscarMovimentacoes,
  buscarRecebimentos,
  buscarExpedicoes,
  registrarEntrada,
  registrarSaida
};
