"use strict";
/**
 * TESTES DE RECEBIMENTO (POST /api/recebimentos)
 * Entrada de mercadoria com lote, fornecedor, documento e validade.
 */

const { config } = require("../helpers/env");
const { iniciarServidor, encerrarServidor, requisitar, login } = require("../helpers/server");
const { criarProdutoViaApi, sufixo, limparPrefixo, saldoDoProduto, lotesDoProduto, movimentacoesDoProduto } = require("../helpers/fixtures");
const { consultar, executar } = require("../helpers/db");

let token;

beforeAll(async () => {
  await iniciarServidor();
  token = (await login(config.USUARIO_OPERADOR.email, config.USUARIO_OPERADOR.senha)).token;
  await limparPrefixo("produtos", "codigo", "TESTE-REC");
});

afterAll(async () => {
  await encerrarServidor();
});

async function criarProdutoRecebimento(nomeExtra = "") {
  const r = await criarProdutoViaApi(token, {
    codigo: `TESTE-REC-${sufixo()}`,
    nome: `Produto Recebimento ${nomeExtra}`,
    possuiValidade: true,
  });
  return r.corpo.produto;
}

async function registrarRecebimento(produtoId, sobrescritas = {}) {
  return requisitar("/api/recebimentos", {
    metodo: "POST",
    token,
    corpo: {
      tipo: "ENTRADA",
      produtoId,
      quantidade: 10,
      numeroLote: `LOTE-REC-${sufixo()}`,
      fornecedor: "Fornecedor Teste",
      documento: "NF-TESTE-001",
      dataValidade: "2027-12-31",
      motivo: "Recebimento de fornecedor",
      observacao: "Observação de teste",
      ...sobrescritas,
    },
  });
}

describe("Recebimento - entrada válida", () => {
  test("registra entrada, cria lote e atualiza saldo", async () => {
    const produto = await criarProdutoRecebimento("Valido");
    const antes = await saldoDoProduto(produto.id);
    expect(antes).toBe(0);

    const r = await registrarRecebimento(produto.id, { quantidade: 15 });
    expect(r.status).toBe(201);
    expect(r.corpo.sucesso).toBe(true);
    expect(r.corpo.dados.quantidade).toBe(15);

    const saldo = await saldoDoProduto(produto.id);
    expect(saldo).toBe(15);

    const lotes = await lotesDoProduto(produto.id);
    expect(lotes.length).toBe(1);
    expect(Number(lotes[0].quantidade_atual)).toBe(15);
  });

  test("cria movimentação ENTRADA/CONFIRMADA e auditoria", async () => {
    const produto = await criarProdutoRecebimento("Auditoria");
    const r = await registrarRecebimento(produto.id, { quantidade: 7 });
    expect(r.status).toBe(201);

    const mov = await movimentacoesDoProduto(produto.id);
    expect(mov.length).toBe(1);
    expect(mov[0].tipo).toBe("ENTRADA");
    expect(mov[0].status).toBe("CONFIRMADA");
    expect(mov[0].observacao).toBe("Observação de teste");

    const auditorias = await consultar(
      "SELECT * FROM auditorias WHERE acao = 'RECEBIMENTO_CONFIRMADO' AND entidade_id = ?",
      [mov[0].id],
    );
    expect(auditorias.length).toBe(1);
    expect(auditorias[0].resultado).toBe("SUCESSO");
  });

  test("fornecedor e documento são gravados no lote", async () => {
    const produto = await criarProdutoRecebimento("Fornecedor");
    await registrarRecebimento(produto.id, { fornecedor: "Fornecedor XYZ", documento: "NF-999" });
    const lotes = await lotesDoProduto(produto.id);
    expect(lotes[0].fornecedor).toBe("Fornecedor XYZ");
    expect(lotes[0].documento).toBe("NF-999");
  });

  test("mesmo número de lote SOMA a quantidade (não cria novo lote)", async () => {
    const produto = await criarProdutoRecebimento("LoteExistente");
    const numeroLote = `LOTE-REC-REPETIDO-${sufixo()}`;

    const r1 = await registrarRecebimento(produto.id, { numeroLote, quantidade: 10 });
    const r2 = await registrarRecebimento(produto.id, { numeroLote, quantidade: 5 });
    expect(r1.status).toBe(201);
    expect(r2.status).toBe(201);

    const lotes = await lotesDoProduto(produto.id);
describe("Recebimento - validações e erros", () => {
  test("quantidade zero -> 400", async () => {
    const produto = await criarProdutoRecebimento("QtdZero");
    const r = await registrarRecebimento(produto.id, { quantidade: 0 });
    expect(r.status).toBe(400);
  });

  test("quantidade negativa -> 400", async () => {
    const produto = await criarProdutoRecebimento("QtdNegativa");
    const r = await registrarRecebimento(produto.id, { quantidade: -5 });
    expect(r.status).toBe(400);
  });

  test("quantidade como texto inválido -> 400", async () => {
    const produto = await criarProdutoRecebimento("QtdTexto");
    const r = await registrarRecebimento(produto.id, { quantidade: "abc" });
    expect(r.status).toBe(400);
  });

  test("produto inexistente -> 404 PRODUTO_NAO_ENCONTRADO", async () => {
    const r = await registrarRecebimento(999999);
    expect(r.status).toBe(404);
    expect(r.corpo.codigo).toBe("PRODUTO_NAO_ENCONTRADO");
  });

  test("produto inativo -> 404 PRODUTO_NAO_ENCONTRADO", async () => {
    const produto = await criarProdutoRecebimento("Inativo");
    await executar("UPDATE produtos SET ativo = FALSE WHERE id = ?", [produto.id]);

    const r = await registrarRecebimento(produto.id);
    expect(r.status).toBe(404);
    expect(r.corpo.codigo).toBe("PRODUTO_NAO_ENCONTRADO");
  });

  test("produtoId ausente -> 400", async () => {
    const r = await requisitar("/api/recebimentos", {
      metodo: "POST",
      token,
      corpo: { tipo: "ENTRADA", quantidade: 5, numeroLote: "LOTE-X" },
    });
    expect(r.status).toBe(400);
  });

  test("tipo com valor inesperado (baixa) -> 400", async () => {
    const produto = await criarProdutoRecebimento("TipoErrado");
    const r = await registrarRecebimento(produto.id, { tipo: "BAIXA" });
    expect(r.status).toBe(400);
  });

  test("operação com erro não altera o saldo (atomicidade básica)", async () => {
    const produto = await criarProdutoRecebimento("Atomicidade");
    const antes = await saldoDoProduto(produto.id);
    await registrarRecebimento(produto.id, { quantidade: -1 });
    const depois = await saldoDoProduto(produto.id);
    expect(depois).toBe(antes);
  });
});
    expect(lotes.length).toBe(1);
    expect(Number(lotes[0].quantidade_atual)).toBe(15);

    const saldo = await saldoDoProduto(produto.id);
    expect(saldo).toBe(15);
  });

  test("data de validade é gravada", async () => {
    const produto = await criarProdutoRecebimento("Validade");
    await registrarRecebimento(produto.id, { dataValidade: "2028-06-15" });
    const lotes = await lotesDoProduto(produto.id);
    const validade = lotes[0].data_validade;
    expect(String(validade).slice(0, 10)).toBe("2028-06-15");
  });
});