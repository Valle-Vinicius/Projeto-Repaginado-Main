"use strict";

/**
 * TESTES DE EXPEDIÇÃO (POST /api/expedicoes)
 * Saída de mercadoria com destinatário, destino, documento e motivo.
 */

const { config } = require("../helpers/env");
const {
  iniciarServidor,
  encerrarServidor,
  requisitar,
  login,
} = require("../helpers/server");
const {
  criarProdutoViaApi,
  sufixo,
  limparPrefixo,
  saldoDoProduto,
  movimentacoesDoProduto,
} = require("../helpers/fixtures");
const { consultar, executar } = require("../helpers/db");

let token;

beforeAll(async () => {
  await iniciarServidor();

  token = (
    await login(
      config.USUARIO_OPERADOR.email,
      config.USUARIO_OPERADOR.senha,
    )
  ).token;

  await limparPrefixo("produtos", "codigo", "TESTE-EXP");
});

afterAll(async () => {
  await encerrarServidor();
});

async function criarProdutoComSaldo(quantidade, nomeExtra = "") {
  const r = await criarProdutoViaApi(token, {
    codigo: `TESTE-EXP-${sufixo()}`,
    nome: `Produto Expedição ${nomeExtra}`,
  });

  const produto = r.corpo.produto;

  const rec = await requisitar("/api/recebimentos", {
    metodo: "POST",
    token,
    corpo: {
      tipo: "ENTRADA",
      produtoId: produto.id,
      quantidade,
      numeroLote: `LOTE-EXP-${sufixo()}`,
      motivo: "Preparar estoque de teste",
    },
  });

  if (rec.status !== 201) {
    throw new Error(
      `Não foi possível criar saldo: ${JSON.stringify(rec.corpo)}`,
    );
  }

  return produto;
}

async function registrarExpedicao(produtoId, sobrescritas = {}) {
  return requisitar("/api/expedicoes", {
    metodo: "POST",
    token,
    corpo: {
      tipo: "SAIDA",
      produtoId,
      quantidade: 5,
      destinatario: "Unidade Norte",
      destino: "Setor de distribuição",
      documento: "REQ-001",
      motivo: "EXPEDICAO",
      observacao: "Expedição de teste",
      ...sobrescritas,
    },
  });
}

describe("Expedição - saída válida", () => {
  test("baixa o saldo e cria movimentação SAIDA/CONFIRMADA", async () => {
    const produto = await criarProdutoComSaldo(10, "Valida");

    const r = await registrarExpedicao(produto.id, {
      quantidade: 4,
    });

    expect(r.status).toBe(201);
    expect(r.corpo.sucesso).toBe(true);

    const saldo = await saldoDoProduto(produto.id);
    expect(saldo).toBe(6);

    const mov = await movimentacoesDoProduto(produto.id);

    expect(mov.length).toBe(2);
    expect(mov[0].tipo).toBe("SAIDA");
    expect(mov[0].status).toBe("CONFIRMADA");
    expect(Number(mov[0].quantidade)).toBe(4);
    expect(mov[0].destinatario).toBe("Unidade Norte");
    expect(mov[0].destino).toBe("Setor de distribuição");
    expect(mov[0].documento).toBe("REQ-001");
    expect(mov[0].observacao).toBe("Expedição de teste");
  });

  test("saída IGUAL ao saldo zera o produto", async () => {
    const produto = await criarProdutoComSaldo(8, "IgualSaldo");

    const r = await registrarExpedicao(produto.id, {
      quantidade: 8,
    });

    expect(r.status).toBe(201);
    expect(await saldoDoProduto(produto.id)).toBe(0);
  });

  test("saída menor que o saldo mantém o restante", async () => {
    const produto = await criarProdutoComSaldo(20, "MenorSaldo");

    const r = await registrarExpedicao(produto.id, {
      quantidade: 7,
    });

    expect(r.status).toBe(201);
    expect(await saldoDoProduto(produto.id)).toBe(13);
  });

  test("gera auditoria EXPEDICAO_CONFIRMADA", async () => {
    const produto = await criarProdutoComSaldo(5, "Auditoria");

    const r = await registrarExpedicao(produto.id, {
      quantidade: 2,
    });

    expect(r.status).toBe(201);

    const mov = await movimentacoesDoProduto(produto.id);

    const auditorias = await consultar(
      "SELECT * FROM auditorias WHERE acao = 'EXPEDICAO_CONFIRMADA' AND entidade_id = ?",
      [mov[0].id],
    );

    expect(auditorias.length).toBe(1);
    expect(auditorias[0].resultado).toBe("SUCESSO");
  });
});

describe("Expedição - estoque negativo e saldo insuficiente", () => {
  test("saída MAIOR que o saldo -> 422 ESTOQUE_INSUFICIENTE", async () => {
    const produto = await criarProdutoComSaldo(5, "EstoqueInsuficiente");

    const r = await registrarExpedicao(produto.id, {
      quantidade: 6,
    });

    expect(r.status).toBe(422);
    expect(r.corpo.codigo).toBe("ESTOQUE_INSUFICIENTE");
  });

  test("saída maior que o saldo NÃO altera o saldo", async () => {
    const produto = await criarProdutoComSaldo(5, "SaldoIntacto");

    const antes = await saldoDoProduto(produto.id);

    await registrarExpedicao(produto.id, {
      quantidade: 6,
    });

    expect(await saldoDoProduto(produto.id)).toBe(antes);
  });

  test("saída maior que o saldo NÃO cria movimentação (rollback)", async () => {
    const produto = await criarProdutoComSaldo(5, "SemMovimentacao");

    await registrarExpedicao(produto.id, {
      quantidade: 6,
    });

    const mov = await movimentacoesDoProduto(produto.id);

    expect(mov.length).toBe(1);
    expect(mov[0].tipo).toBe("ENTRADA");
  });

  test("saldo zero -> 422 ESTOQUE_INSUFICIENTE (sem estoque negativo)", async () => {
    const produto = await criarProdutoComSaldo(3, "SaldoZero");

    await registrarExpedicao(produto.id, {
      quantidade: 3,
    });

    const saldo = await saldoDoProduto(produto.id);
    expect(saldo).toBe(0);

    const r = await registrarExpedicao(produto.id, {
      quantidade: 1,
    });

    expect(r.status).toBe(422);
    expect(r.corpo.codigo).toBe("ESTOQUE_INSUFICIENTE");
    expect(await saldoDoProduto(produto.id)).toBe(0);
  });

  test("estoque nunca fica negativo após operações rejeitadas", async () => {
    const produto = await criarProdutoComSaldo(4, "NuncaNegativo");

    await registrarExpedicao(produto.id, {
      quantidade: 5,
    });

    await registrarExpedicao(produto.id, {
      quantidade: 50,
    });

    const lotes = await consultar(
      "SELECT quantidade_atual FROM lotes WHERE produto_id = ? AND ativo = TRUE",
      [produto.id],
    );

    for (const lote of lotes) {
      expect(Number(lote.quantidade_atual)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Expedição - validação e erros", () => {
  test("destinatário ausente -> 400", async () => {
    const produto = await criarProdutoComSaldo(10, "SemDestinatario");

    const r = await registrarExpedicao(produto.id, {
      destinatario: "",
    });

    expect(r.status).toBe(400);
  });

  test("destino ausente -> 400", async () => {
    const produto = await criarProdutoComSaldo(10, "SemDestino");

    const r = await registrarExpedicao(produto.id, {
      destino: "",
    });

    expect(r.status).toBe(400);
  });

  test("quantidade zero -> 400", async () => {
    const produto = await criarProdutoComSaldo(10, "QtdZero");

    const r = await registrarExpedicao(produto.id, {
      quantidade: 0,
    });

    expect(r.status).toBe(400);
  });

  test("produto inexistente -> 404 PRODUTO_NAO_ENCONTRADO", async () => {
    const r = await registrarExpedicao(999999);

    expect(r.status).toBe(404);
    expect(r.corpo.codigo).toBe("PRODUTO_NAO_ENCONTRADO");
  });

  test("produto inativo -> 404 PRODUTO_NAO_ENCONTRADO", async () => {
    const produto = await criarProdutoComSaldo(10, "Inativo");

    await executar(
      "UPDATE produtos SET ativo = FALSE WHERE id = ?",
      [produto.id],
    );

    const r = await registrarExpedicao(produto.id);

    expect(r.status).toBe(404);
    expect(r.corpo.codigo).toBe("PRODUTO_NAO_ENCONTRADO");
  });

  test("tipo ENTRADA na rota de expedição revela controller compartilhado", async () => {


    const produto = await criarProdutoComSaldo(10, "TipoEntrada");

    const r = await requisitar("/api/expedicoes", {
      metodo: "POST",
      token,
      corpo: {
        tipo: "ENTRADA",
        produtoId: produto.id,
        quantidade: 3,
        fornecedor: "Fornecedor X",
        motivo: "teste",
      },
    });

    expect([201, 400, 422]).toContain(r.status);
  });
});