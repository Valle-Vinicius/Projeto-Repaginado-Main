"use strict";
/**
 * TESTES DE FIFO (ordem de consumo dos lotes)
 *
 * A implementação REAL (backend/repositories/estoqueRepository.js) ordena os
 * lotes na saída por:
 *   1) com data_validade antes de NULL;
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
  await limparPrefixo("produtos", "codigo", "TESTE-FIFO");
});

afterAll(async () => {
  await encerrarServidor();
});

async function novoProduto(nomeExtra) {
  const r = await criarProdutoViaApi(token, {
    codigo: `TESTE-FIFO-${sufixo()}`,
    nome: `Produto FIFO ${nomeExtra}`,
    possuiValidade: true,
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
      motivo: "FIFO",
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
      destinatario: "Unidade FIFO",
      destino: "Distribuição FIFO",
      motivo: "EXPEDICAO",
    },
  });
}

function dataFutura(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

describe("FIFO - validade mais próxima é consumida primeiro", () => {
  test("saída de 25 consome primeiro o lote com validade mais próxima", async () => {
    const produto = await novoProduto("PrioridadeValidade");
    // Lote A: 20 un, validade em +40 dias (inserido PRIMEIRO)
    await entrada(produto.id, "FIFO-A", 20, dataFutura(40));
    // Lote B: 30 un, validade em +10 dias (inserido DEPOIS)
    await entrada(produto.id, "FIFO-B", 30, dataFutura(10));

    const r = await saida(produto.id, 25);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const loteA = lotes.find((l) => l.numero_lote === "FIFO-A");
    const loteB = lotes.find((l) => l.numero_lote === "FIFO-B");

    // O lote B (validade mais próxima) foi o único consumido.
    expect(Number(loteA.quantidade_atual)).toBe(20);
    expect(Number(loteB.quantidade_atual)).toBe(5);
    expect(await saldoDoProduto(produto.id)).toBe(25);
  });

  test("saída que atravessa vários lotes consome cada um em sequência FIFO", async () => {
    const produto = await novoProduto("MultiplosLotes");
    await entrada(produto.id, "FIFO-M-A", 20, dataFutura(40));
    await entrada(produto.id, "FIFO-M-B", 30, dataFutura(10));

    // Consome B inteiro (30) + 20 do A = 50
    const r = await saida(produto.id, 50);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const loteA = lotes.find((l) => l.numero_lote === "FIFO-M-A");
    const loteB = lotes.find((l) => l.numero_lote === "FIFO-M-B");
    expect(Number(loteB.quantidade_atual)).toBe(0);
    expect(Number(loteA.quantidade_atual)).toBe(0);

    // Cada lote consumido gera UMA movimentação de SAIDA (com lote_id).
    const movs = await movimentacoesDoProduto(produto.id);
    const saidas = movs.filter((m) => m.tipo === "SAIDA");
    expect(saidas.length).toBe(2);
  });
});

describe("FIFO - lotes sem validade e vencidos", () => {
  test("lote SEM validade é consumido DEPOIS dos lotes com validade", async () => {
    const produto = await novoProduto("SemValidade");
    await entrada(produto.id, "FIFO-NULL", 20, null); // sem validade
    await entrada(produto.id, "FIFO-COMVALIDADE", 20, dataFutura(60));

    const r = await saida(produto.id, 15);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const semValidade = lotes.find((l) => l.numero_lote === "FIFO-NULL");
    const comValidade = lotes.find((l) => l.numero_lote === "FIFO-COMVALIDADE");
    // Com validade foi consumido primeiro.
    expect(Number(comValidade.quantidade_atual)).toBe(5);
    expect(Number(semValidade.quantidade_atual)).toBe(20);
  });

  test("lote VENCIDO (validade no passado) é consumido primeiro", async () => {
    const produto = await novoProduto("Vencido");
    await entrada(produto.id, "FIFO-VENCIDO", 10, "2020-01-01");
    await entrada(produto.id, "FIFO-NORMAL", 10, dataFutura(30));

    const r = await saida(produto.id, 5);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const vencido = lotes.find((l) => l.numero_lote === "FIFO-VENCIDO");
    const normal = lotes.find((l) => l.numero_lote === "FIFO-NORMAL");
    expect(Number(vencido.quantidade_atual)).toBe(5);
    expect(Number(normal.quantidade_atual)).toBe(10);
  });
});
describe("FIFO - empate de validade e consumo total", () => {
  test("mesma validade: lote com criado_em mais antigo sai primeiro", async () => {
    const produto = await novoProduto("EmpateValidade");
    const mesmaValidade = dataFutura(90);
    await entrada(produto.id, "FIFO-T-A", 20, mesmaValidade);
    await entrada(produto.id, "FIFO-T-B", 30, mesmaValidade);

    // Força criado_em diferentes para quebrar o empate de validade.
    await executar(
      `UPDATE lotes SET criado_em = DATE_SUB(NOW(), INTERVAL 2 DAY) WHERE numero_lote = 'FIFO-T-A'`,
    );
    await executar(
      `UPDATE lotes SET criado_em = NOW() WHERE numero_lote = 'FIFO-T-B'`,
    );

    const r = await saida(produto.id, 25);
    expect(r.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
    const loteA = lotes.find((l) => l.numero_lote === "FIFO-T-A");
    const loteB = lotes.find((l) => l.numero_lote === "FIFO-T-B");
    // O mais antigo (A) foi consumido primeiro: A ficou com 0, B com 25.
    expect(Number(loteA.quantidade_atual)).toBe(0);
    expect(Number(loteB.quantidade_atual)).toBe(25);
  });

  test("consumo total do produto possível sem sobra", async () => {
    const produto = await novoProduto("ConsumoTotal");
    await entrada(produto.id, "FIFO-C-1", 10, dataFutura(20));
    await entrada(produto.id, "FIFO-C-2", 10, dataFutura(30));

    const r = await saida(produto.id, 20);
    expect(r.status).toBe(201);
    expect(await saldoDoProduto(produto.id)).toBe(0);

    // Nova entrada sobre o mesmo produto volta a funcionar.
    await entrada(produto.id, "FIFO-C-3", 7, dataFutura(15));
    expect(await saldoDoProduto(produto.id)).toBe(7);
  });
});