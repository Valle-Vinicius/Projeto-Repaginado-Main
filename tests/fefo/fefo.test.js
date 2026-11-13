"use strict";
/**
 * TESTES DE FEFO (lote com validade mais próxima consumido primeiro)
 *
 * A implementação REAL (backend/repositories/estoqueRepository.js) ordena os
 * lotes na saída por:
 *   1) somente lotes não vencidos, sem data apenas para produto sem controle;
 *   2) data_validade ASC (o que vence primeiro sai primeiro);
 *   3) criado_em ASC;
 *   4) id ASC.
 *
 * Este arquivo verifica o comportamento OBSERVADO (e não o esperado no
 * papel) para cada cenário.
 */

const { config } = require("../helpers/env");
const { iniciarServidor, encerrarServidor, requisitar, login } = require("../helpers/server");
const { criarProdutoViaApi, sufixo, limparPrefixo, saldoDoProduto, lotesDoProduto, movimentacoesDoProduto } = require("../helpers/fixtures");
const { executar } = require("../helpers/db");

let token;

beforeAll(async () => {
  await iniciarServidor();
  token = (await login(config.USUARIO_OPERADOR.email, config.USUARIO_OPERADOR.senha)).token;
  await limparPrefixo("produtos", "codigo", "TESTE-FEFO");
});

afterAll(async () => {
  await encerrarServidor();
});

async function novoProduto(nomeExtra, possuiValidade = true) {
  const r = await criarProdutoViaApi(token, {
    codigo: `TESTE-FEFO-${sufixo()}`,
    nome: `Produto FEFO ${nomeExtra}`,
    possuiValidade,
  });
  return r.corpo.produto;
}

async function entrada(produtoId, numeroLote, quantidade, dataValidade = null) {
  const r = await requisitar("/api/recebimentos", {
    metodo: "POST",
    token,
    corpo: {
      tipo: "ENTRADA",
      produtoId,
      quantidade,
      numeroLote,
      dataValidade,
      motivo: "FEFO",
    },
  });
  if (r.status !== 201) throw new Error(`entrada falhou: ${JSON.stringify(r.corpo)}`);
}

async function saida(produtoId, quantidade) {
  return requisitar("/api/expedicoes", {
    metodo: "POST",
    token,
    corpo: {
      tipo: "SAIDA",
      produtoId,
      quantidade,
      destinatario: "Unidade FEFO",
      destino: "Distribuição FEFO",
      motivo: "EXPEDICAO",
    },
  });
}

function dataFutura(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

describe("FEFO - validade mais próxima é consumida primeiro", () => {
  test("saída de 25 consome primeiro o lote com validade mais próxima", async () => {
    const produto = await novoProduto("PrioridadeValidade");
    // Lote A: 20 un, validade em +40 dias (inserido PRIMEIRO)
    await entrada(produto.id, "FEFO-A", 20, dataFutura(40));
    // Lote B: 30 un, validade em +10 dias (inserido DEPOIS)
    await entrada(produto.id, "FEFO-B", 30, dataFutura(10));

    const r = await saida(produto.id, 25);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const loteA = lotes.find((l) => l.numero_lote === "FEFO-A");
    const loteB = lotes.find((l) => l.numero_lote === "FEFO-B");

    // O lote B (validade mais próxima) foi o único consumido.
    expect(Number(loteA.quantidade_atual)).toBe(20);
    expect(Number(loteB.quantidade_atual)).toBe(5);
    expect(await saldoDoProduto(produto.id)).toBe(25);
  });

  test("saída que atravessa vários lotes consome cada um em sequência FEFO", async () => {
    const produto = await novoProduto("MultiplosLotes");
    await entrada(produto.id, "FEFO-M-A", 20, dataFutura(40));
    await entrada(produto.id, "FEFO-M-B", 30, dataFutura(10));

    // Consome B inteiro (30) + 20 do A = 50
    const r = await saida(produto.id, 50);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const loteA = lotes.find((l) => l.numero_lote === "FEFO-M-A");
    const loteB = lotes.find((l) => l.numero_lote === "FEFO-M-B");
    expect(Number(loteB.quantidade_atual)).toBe(0);
    expect(Number(loteA.quantidade_atual)).toBe(0);

    // Cada lote consumido gera UMA movimentação de SAIDA (com lote_id).
    const movs = await movimentacoesDoProduto(produto.id);
    const saidas = movs.filter((m) => m.tipo === "SAIDA");
    expect(saidas.length).toBe(2);
  });
});

describe("FEFO - lotes sem validade e vencidos", () => {
  test("lote SEM validade é consumido DEPOIS dos lotes com validade", async () => {
    const produto = await novoProduto("SemValidade", false);
    await entrada(produto.id, "FEFO-NULL", 20, null); // sem validade
    await entrada(produto.id, "FEFO-COMVALIDADE", 20, dataFutura(60));

    const r = await saida(produto.id, 15);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const semValidade = lotes.find((l) => l.numero_lote === "FEFO-NULL");
    const comValidade = lotes.find((l) => l.numero_lote === "FEFO-COMVALIDADE");
    // Com validade foi consumido primeiro.
    expect(Number(comValidade.quantidade_atual)).toBe(5);
    expect(Number(semValidade.quantidade_atual)).toBe(20);
  });

  test("lote vencido não é expedido e não conta como saldo disponível", async () => {
    const produto = await novoProduto("Vencido");
    await entrada(produto.id, "FEFO-VENCIDO", 10, dataFutura(30));
    await executar(
      "UPDATE lotes SET data_validade = CURRENT_DATE - 1 WHERE produto_id = ?",
      [produto.id],
    );

    const estoque = await requisitar("/api/estoque", { token });
    const produtoNoEstoque = estoque.corpo.produtos.find(
      (item) => Number(item.id) === Number(produto.id),
    );
    expect(Number(produtoNoEstoque.estoque)).toBe(0);
    expect(produtoNoEstoque.status).toBe("SEM_ESTOQUE");

    const produtos = await requisitar(
      `/api/produtos?busca=${encodeURIComponent(produto.nome)}`,
      { token },
    );
    const produtoNoCatalogo = produtos.corpo.dados.find(
      (item) => Number(item.id) === Number(produto.id),
    );
    expect(Number(produtoNoCatalogo.estoque)).toBe(0);
    expect(produtoNoCatalogo.status).toBe("SEM_ESTOQUE");

    const r = await saida(produto.id, 5);
    expect(r.status).toBe(422);
    expect(r.corpo.codigo).toBe("LOTE_VENCIDO");

    const lotes = await lotesDoProduto(produto.id);
    const vencido = lotes.find((l) => l.numero_lote === "FEFO-VENCIDO");
    expect(Number(vencido.quantidade_atual)).toBe(10);
  });

  test("lote vencido não é usado quando há saldo válido suficiente", async () => {
    const produto = await novoProduto("VencidoComValido");
    await entrada(produto.id, "FEFO-VENCIDO-MISTO", 10, dataFutura(20));
    await entrada(produto.id, "FEFO-VALIDO-MISTO", 10, dataFutura(30));
    await executar(
      "UPDATE lotes SET data_validade = CURRENT_DATE - 1 WHERE produto_id = ? AND numero_lote = ?",
      [produto.id, "FEFO-VENCIDO-MISTO"],
    );

    const r = await saida(produto.id, 5);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const vencido = lotes.find((l) => l.numero_lote === "FEFO-VENCIDO-MISTO");
    const valido = lotes.find((l) => l.numero_lote === "FEFO-VALIDO-MISTO");
    expect(Number(vencido.quantidade_atual)).toBe(10);
    expect(Number(valido.quantidade_atual)).toBe(5);
  });

  test("lote sem validade de produto controlado não fica disponível para expedição", async () => {
    const produto = await novoProduto("SemDataLegada");
    await entrada(produto.id, "FEFO-SEM-DATA", 10, dataFutura(30));
    await executar(
      "UPDATE lotes SET data_validade = NULL WHERE produto_id = ?",
      [produto.id],
    );

    const r = await saida(produto.id, 5);
    expect(r.status).toBe(422);
    expect(r.corpo.codigo).toBe("LOTE_SEM_VALIDADE");
    expect(await saldoDoProduto(produto.id)).toBe(10);
  });

  test("ajuste não pode criar saldo sem validade para produto controlado", async () => {
    const produto = await novoProduto("AjusteSemValidade");
    const r = await requisitar("/api/estoque/ajuste", {
      metodo: "POST",
      token,
      corpo: { produtoId: produto.id, quantidadeNova: 5 },
    });

    expect(r.status).toBe(400);
    expect(r.corpo.codigo).toBe("AJUSTE_EXIGE_LOTE_COM_VALIDADE");
    expect(await saldoDoProduto(produto.id)).toBe(0);
  });
});
describe("FEFO - empate de validade e consumo total", () => {
  test("mesma validade: lote com criado_em mais antigo sai primeiro", async () => {
    const produto = await novoProduto("EmpateValidade");
    const mesmaValidade = dataFutura(90);
    await entrada(produto.id, "FEFO-T-A", 20, mesmaValidade);
    await entrada(produto.id, "FEFO-T-B", 30, mesmaValidade);

    // Força criado_em diferentes para quebrar o empate de validade.
    await executar(
      `UPDATE lotes SET criado_em = NOW() - INTERVAL '2 days' WHERE numero_lote = 'FEFO-T-A'`,
    );
    await executar(
      `UPDATE lotes SET criado_em = CURRENT_TIMESTAMP WHERE numero_lote = 'FEFO-T-B'`,
    );

    const r = await saida(produto.id, 25);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const loteA = lotes.find((l) => l.numero_lote === "FEFO-T-A");
    const loteB = lotes.find((l) => l.numero_lote === "FEFO-T-B");
    // O mais antigo (A) foi consumido primeiro: A ficou com 0, B com 25.
    expect(Number(loteA.quantidade_atual)).toBe(0);
    expect(Number(loteB.quantidade_atual)).toBe(25);
  });

  test("consumo total do produto possível sem sobra", async () => {
    const produto = await novoProduto("ConsumoTotal");
    await entrada(produto.id, "FEFO-C-1", 10, dataFutura(20));
    await entrada(produto.id, "FEFO-C-2", 10, dataFutura(30));

    const r = await saida(produto.id, 20);
    expect(r.status).toBe(201);
    expect(await saldoDoProduto(produto.id)).toBe(0);

    // Nova entrada sobre o mesmo produto volta a funcionar.
    await entrada(produto.id, "FEFO-C-3", 7, dataFutura(15));
    expect(await saldoDoProduto(produto.id)).toBe(7);
  });
});