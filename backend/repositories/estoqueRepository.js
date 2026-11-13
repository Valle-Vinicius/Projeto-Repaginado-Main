const { executarQuery, executarTransacao } = require('../config/database');

async function buscarProdutosComSaldo() {
  return executarQuery(`
    SELECT p.id, p.codigo, p.nome, p.unidade,
      p.estoque_minimo AS estoqueMinimo,
      p.possui_validade AS possuiValidade,
      c.id AS categoriaId,
      c.nome AS categoria,
      COALESCE((SELECT SUM(l2.quantidade_atual) FROM lotes l2 WHERE l2.produto_id = p.id AND l2.ativo = TRUE AND (l2.data_validade >= CURRENT_DATE OR (l2.data_validade IS NULL AND p.possui_validade = FALSE))), 0) AS estoqueAtual,
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
    [Number(limite)]
  );
}

async function buscarRecebimentos({ limite = 500 } = {}) {
  return executarQuery(
    `
    SELECT m.id, m.criado_em AS criadoEm, p.id AS produtoId,
      p.nome AS produto, p.codigo, l.numero_lote AS numeroLote,
      l.fornecedor, l.documento,
      TO_CHAR(l.data_validade, 'YYYY-MM-DD') AS dataValidade,
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
    [Number(limite)]
  );
}

async function buscarCategorias() {
  return executarQuery('SELECT id, nome FROM categorias WHERE ativo = TRUE ORDER BY nome ASC');
}

async function buscarLocalizacoes() {
  return executarQuery('SELECT id, nome FROM localizacoes WHERE ativo = TRUE ORDER BY nome ASC');
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
    [Number(limite)]
  );
}

function criarErroEstoque(mensagem, statusCode, codigo) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  erro.codigo = codigo;
  return erro;
}

async function buscarProdutoComLotes(conexao, produtoId, { incluirVencidos = false } = {}) {
  const [produtos] = await conexao.execute(
    'SELECT id, nome, codigo, unidade, possui_validade AS possuiValidade FROM produtos WHERE id = ? AND ativo = TRUE FOR SHARE',
    [produtoId]
  );
  if (!produtos.length) {
    return null;
  }
  const filtroValidade = incluirVencidos
    ? ''
    : 'AND (data_validade >= CURRENT_DATE OR (data_validade IS NULL AND ? = FALSE))';
  const [lotes] = await conexao.execute(
    `
    SELECT id, numero_lote, quantidade_atual
    FROM lotes
    WHERE produto_id = ? AND ativo = TRUE AND quantidade_atual > 0
      ${filtroValidade}
    ORDER BY CASE WHEN data_validade IS NULL THEN 1 ELSE 0 END,
      data_validade ASC, criado_em ASC, id ASC
    FOR UPDATE
  `,
    incluirVencidos ? [produtoId] : [produtoId, produtos[0].possuiValidade]
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
      const erro = new Error('Produto não encontrado ou inativo.');
      erro.statusCode = 404;
      erro.codigo = 'PRODUTO_NAO_ENCONTRADO';
      throw erro;
    }
    const saldoTotal = dados.lotes.reduce(
      (total, lote) => total + Number(lote.quantidade_atual),
      0
    );
    if (saldoTotal < quantidade) {
      const [lotesVencidos] = await conexao.execute(
        `SELECT
           COALESCE(SUM(quantidade_atual) FILTER (
             WHERE data_validade < CURRENT_DATE
           ), 0) AS quantidadeVencida,
           COALESCE(SUM(quantidade_atual) FILTER (
             WHERE data_validade IS NULL
           ), 0) AS quantidadeSemValidade
         FROM lotes
         WHERE produto_id = ? AND ativo = TRUE AND quantidade_atual > 0`,
        [produtoId]
      );
      const quantidadeVencida = Number(lotesVencidos[0]?.quantidadeVencida || 0);
      const quantidadeSemValidade = Number(
        lotesVencidos[0]?.quantidadeSemValidade || 0
      );

      if (quantidadeVencida > 0) {
        throw criarErroEstoque(
          `Saldo válido insuficiente. Disponível: ${saldoTotal}. Há ${quantidadeVencida} unidade(s) vencida(s); segregue-as e encaminhe-as para descarte.`,
          422,
          'LOTE_VENCIDO'
        );
      }
      if (dados.produto.possuiValidade && quantidadeSemValidade > 0) {
        throw criarErroEstoque(
          `Saldo válido insuficiente. Há ${quantidadeSemValidade} unidade(s) sem validade cadastrada; segregue-as e regularize os lotes antes da expedição.`,
          422,
          'LOTE_SEM_VALIDADE'
        );
      }

      const erro = new Error(`Estoque insuficiente. Disponível: ${saldoTotal}.`);
      erro.statusCode = 422;
      erro.codigo = 'ESTOQUE_INSUFICIENTE';
      throw erro;
    }

    let restante = quantidade;
    const movimentacoes = [];
    for (const lote of dados.lotes) {
      if (restante <= 0) {
        break;
      }
      const retirada = Math.min(Number(lote.quantidade_atual), restante);
      await conexao.execute(
        'UPDATE lotes SET quantidade_atual = quantidade_atual - ? WHERE id = ?',
        [retirada, lote.id]
      );
      const [resultado] = await conexao.execute(
        `
        INSERT INTO movimentacoes
          (produto_id, lote_id, usuario_id, destinatario, destino, documento, tipo, quantidade, status, observacao)
        VALUES (?, ?, ?, ?, ?, ?, 'SAIDA', ?, 'CONFIRMADA', ?)
        RETURNING id
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
        ]
      );
      movimentacoes.push({
        id: resultado[0].id,
        loteId: lote.id,
        numeroLote: lote.numero_lote,
        quantidade: retirada,
      });
      restante -= retirada;
    }

    const auditoria = await auditoriaRepository.registrarNaConexao(conexao, {
      usuarioId,
      acao: 'EXPEDICAO_CONFIRMADA',
      entidade: 'MOVIMENTACAO',
      entidadeId: movimentacoes[0].id,
      resultado: 'SUCESSO',
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
      'SELECT id, nome, codigo, unidade, possui_validade AS possuiValidade FROM produtos WHERE id = ? AND ativo = TRUE FOR SHARE',
      [produtoId]
    );
    if (!produtos.length) {
      const erro = new Error('Produto não encontrado ou inativo.');
      erro.statusCode = 404;
      erro.codigo = 'PRODUTO_NAO_ENCONTRADO';
      throw erro;
    }

    if (produtos[0].possuiValidade && !dataValidade) {
      throw criarErroEstoque(
        'Informe a data de validade para este produto.',
        400,
        'DATA_VALIDADE_OBRIGATORIA'
      );
    }

    if (dataValidade) {
      const [datas] = await conexao.execute(
        'SELECT ?::date < CURRENT_DATE AS validadeVencida',
        [dataValidade]
      );
      if (datas[0]?.validadeVencida) {
        throw criarErroEstoque(
          'A data de validade não pode estar no passado.',
          400,
          'DATA_VALIDADE_VENCIDA'
        );
      }
    }

    let loteId;
    if (numeroLote) {
      const [existentes] = await conexao.execute(
        'SELECT id, data_validade IS DISTINCT FROM ?::date AS validadeDiferente FROM lotes WHERE produto_id = ? AND numero_lote = ? FOR UPDATE',
        [dataValidade || null, produtoId, numeroLote]
      );
      if (existentes.length) {
        if (existentes[0].validadeDiferente) {
          throw criarErroEstoque(
            'A validade informada não corresponde à validade já registrada neste lote. Use outro número de lote.',
            409,
            'VALIDADE_LOTE_DIVERGENTE'
          );
        }

        loteId = existentes[0].id;
        await conexao.execute(
          'UPDATE lotes SET quantidade_atual = quantidade_atual + ?, fornecedor = COALESCE(?, fornecedor), documento = COALESCE(?, documento), localizacao_id = COALESCE(?, localizacao_id) WHERE id = ?',
          [
            quantidade,
            fornecedor || null,
            documento || null,
            localizacaoId || null,
            loteId,
          ]
        );
      }
    }
    if (!loteId) {
      const [novoLote] = await conexao.execute(
        `
        INSERT INTO lotes (produto_id, numero_lote, fornecedor, documento, quantidade_atual, data_validade, localizacao_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        RETURNING id
      `,
        [
          produtoId,
          numeroLote || `ENTRADA-${Date.now()}`,
          fornecedor || null,
          documento || null,
          quantidade,
          dataValidade || null,
          localizacaoId || null,
        ]
      );
      loteId = novoLote[0].id;
    }

    const [movimento] = await conexao.execute(
      `
      INSERT INTO movimentacoes (produto_id, lote_id, usuario_id, documento, tipo, quantidade, status, observacao)
      VALUES (?, ?, ?, ?, 'ENTRADA', ?, 'CONFIRMADA', ?)
      RETURNING id
    `,
      [produtoId, loteId, usuarioId || null, documento || null, quantidade, observacao || null]
    );

    const auditoria = await auditoriaRepository.registrarNaConexao(conexao, {
      usuarioId,
      acao: 'RECEBIMENTO_CONFIRMADO',
      entidade: 'MOVIMENTACAO',
      entidadeId: movimento[0].id,
      resultado: 'SUCESSO',
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
      movimentacaoId: movimento[0].id,
      auditoria,
    };
  });
}

async function registrarAjuste({
  produtoId,
  quantidadeNova,
  usuarioId,
  observacao,
  numeroLote,
  dataValidade,
  auditoriaRepository,
}) {
  return executarTransacao(async (conexao) => {
    const dados = await buscarProdutoComLotes(conexao, produtoId, { incluirVencidos: true });
    if (!dados) {
      const erro = new Error('Produto não encontrado ou inativo.');
      erro.statusCode = 404;
      erro.codigo = 'PRODUTO_NAO_ENCONTRADO';
      throw erro;
    }

    const saldoAtual = dados.lotes.reduce(
      (total, lote) => total + Number(lote.quantidade_atual),
      0
    );

    const diferenca = quantidadeNova - saldoAtual;

    if (diferenca === 0) {
      return { produto: dados.produto, ajuste: 0, movimentacoes: [] };
    }

    const movimentacoes = [];

    if (diferenca > 0) {
      if (!numeroLote) {
        throw criarErroEstoque(
          'Informe o número do lote para aumentar o estoque por ajuste.',
          400,
          'AJUSTE_LOTE_OBRIGATORIO'
        );
      }
      if (dados.produto.possuiValidade && !dataValidade) {
        throw criarErroEstoque(
          'Informe a validade para este produto. Registre o lote com sua validade.',
          400,
          'AJUSTE_EXIGE_LOTE_COM_VALIDADE'
        );
      }
      if (dataValidade) {
        const [datas] = await conexao.execute(
          'SELECT ?::date < CURRENT_DATE AS validadeVencida',
          [dataValidade]
        );
        if (datas[0]?.validadeVencida) {
          throw criarErroEstoque(
            'A data de validade não pode estar no passado.',
            400,
            'DATA_VALIDADE_VENCIDA'
          );
        }
      }

      const [lotesExistentes] = await conexao.execute(
        'SELECT id, ativo, data_validade IS DISTINCT FROM ?::date AS validadeDiferente FROM lotes WHERE produto_id = ? AND numero_lote = ? FOR UPDATE',
        [dataValidade || null, produtoId, numeroLote]
      );
      let loteId;
      if (lotesExistentes.length) {
        const lote = lotesExistentes[0];
        if (!lote.ativo) {
          throw criarErroEstoque(
            'Este número de lote já está inativo. Informe outro lote.',
            409,
            'LOTE_INATIVO'
          );
        }
        if (lote.validadeDiferente) {
          throw criarErroEstoque(
            'A validade informada não corresponde à validade já registrada neste lote. Use outro número de lote.',
            409,
            'VALIDADE_LOTE_DIVERGENTE'
          );
        }

        loteId = lote.id;
        await conexao.execute(
          'UPDATE lotes SET quantidade_atual = quantidade_atual + ? WHERE id = ?',
          [diferenca, loteId]
        );
      } else {
        const [loteResult] = await conexao.execute(
          `INSERT INTO lotes (produto_id, numero_lote, fornecedor, quantidade_inicial, quantidade_atual, data_validade, localizacao_id, ativo)
           VALUES (?, ?, 'Ajuste de estoque', ?, ?, ?, NULL, TRUE)
           RETURNING id`,
          [produtoId, numeroLote, diferenca, diferenca, dataValidade || null]
        );
        loteId = loteResult[0].id;
      }

      const [movResult] = await conexao.execute(
        `INSERT INTO movimentacoes (produto_id, lote_id, usuario_id, tipo, quantidade, status, observacao)
         VALUES (?, ?, ?, 'AJUSTE', ?, 'CONFIRMADA', ?)
         RETURNING id`,
        [produtoId, loteId, usuarioId || null, diferenca, observacao]
      );
      movimentacoes.push({ id: movResult[0].id, loteId, quantidade: diferenca });
    } else {
      // Remover dos lotes existentes segundo a ordenação FEFO.
      let restante = Math.abs(diferenca);
      for (const lote of dados.lotes) {
        if (restante <= 0) {
          break;
        }
        const retirada = Math.min(Number(lote.quantidade_atual), restante);
        await conexao.execute(
          'UPDATE lotes SET quantidade_atual = quantidade_atual - ? WHERE id = ?',
          [retirada, lote.id]
        );
        const [movResult] = await conexao.execute(
          `INSERT INTO movimentacoes (produto_id, lote_id, usuario_id, tipo, quantidade, status, observacao)
           VALUES (?, ?, ?, 'AJUSTE', ?, 'CONFIRMADA', ?)
           RETURNING id`,
          [produtoId, lote.id, usuarioId || null, -retirada, observacao]
        );
        movimentacoes.push({ id: movResult[0].id, loteId: lote.id, quantidade: -retirada });
        restante -= retirada;
      }
    }

    await auditoriaRepository.registrarNaConexao(conexao, {
      usuarioId,
      acao: 'AJUSTE_ESTOQUE',
      entidade: 'PRODUTO',
      entidadeId: produtoId,
      resultado: 'SUCESSO',
      detalhes: {
        produtoId,
        produto: dados.produto.nome,
        codigo: dados.produto.codigo,
        saldoAnterior: saldoAtual,
        saldoNovo: quantidadeNova,
        diferenca,
        numeroLote: diferenca > 0 ? numeroLote : null,
        dataValidade: diferenca > 0 ? dataValidade || null : null,
        justificativa: observacao,
      },
    });

    return {
      produto: dados.produto,
      saldoAnterior: saldoAtual,
      saldoNovo: quantidadeNova,
      diferenca,
      movimentacoes,
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
  registrarAjuste,
  buscarProdutoComLotes,
};
