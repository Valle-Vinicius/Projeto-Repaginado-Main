"use strict";
/**
 * TESTES DE PRODUTOS
 * Comportamento real de GET /api/produtos, GET /api/produtos/categorias
 * e POST /api/produtos.
 */

const { config } = require("../helpers/env");
const { iniciarServidor, encerrarServidor, requisitar, login } = require("../helpers/server");
const { criarProdutoViaApi, sufixo, limparPrefixo } = require("../helpers/fixtures");
const { consultar, executar } = require("../helpers/db");

let token;

beforeAll(async () => {
  await iniciarServidor();
  token = (await login(config.USUARIO_OPERADOR.email, config.USUARIO_OPERADOR.senha)).token;
  await limparPrefixo("produtos", "codigo", "TESTE-PROD");
});

afterAll(async () => {
  await encerrarServidor();
});

async function categoriaValida() {
  const linhas = await consultar("SELECT id FROM categorias WHERE ativo = TRUE ORDER BY id LIMIT 1");
  return linhas[0].id;
}

describe("Produtos - criação", () => {
  test("produto válido é criado com sucesso (201)", async () => {
    const categoriaId = await categoriaValida();
    const codigo = `TESTE-PROD-${sufixo()}`;
    const resultado = await criarProdutoViaApi(token, {
      codigo,
      nome: "Produto de teste criado via API",
      categoriaId,
      estoqueMinimo: 5,
      unidade: "UN",
      possuiValidade: true,
    });
    expect(resultado.status).toBe(201);
    expect(resultado.corpo.sucesso).toBe(true);
    expect(resultado.corpo.produto.codigo).toBe(codigo);
    expect(resultado.corpo.produto.nome).toBe("Produto de teste criado via API");
    // Cadastro começa com estoque zero (regra do formulário/front).
    expect(Number(resultado.corpo.produto.estoque)).toBe(0);
  });

  test("SKU duplicado retorna 409 PRODUTO_DUPLICADO", async () => {
    const categoriaId = await categoriaValida();
    const codigo = `TESTE-PROD-DUP-${sufixo()}`;
    const primeiro = await criarProdutoViaApi(token, { codigo, categoriaId });
    expect(primeiro.status).toBe(201);

    const segundo = await criarProdutoViaApi(token, { codigo, categoriaId });
    expect(segundo.status).toBe(409);
    expect(segundo.corpo.codigo).toBe("PRODUTO_DUPLICADO");
  });
});

describe("Produtos - validação do payload", () => {
  const categoriaId = 1;

  test("SKU com menos de 3 caracteres -> 400", async () => {
    const r = await criarProdutoViaApi(token, { codigo: "AB", categoriaId });
    expect(r.status).toBe(400);
  });

  test("SKU com caracteres não permitidos -> 400", async () => {
    const r = await criarProdutoViaApi(token, { codigo: "COD COM ESPAÇO", categoriaId });
    expect(r.status).toBe(400);
  });

  test("nome com menos de 3 caracteres -> 400", async () => {
    const r = await criarProdutoViaApi(token, { codigo: `TESTE-PROD-${sufixo()}`, nome: "AB", categoriaId });
    expect(r.status).toBe(400);
  });

  test("categoria inexistente -> 404 CATEGORIA_NAO_ENCONTRADA", async () => {
    const r = await criarProdutoViaApi(token, { codigo: `TESTE-PROD-${sufixo()}`, categoriaId: 999999 });
    expect(r.status).toBe(404);
    expect(r.corpo.codigo).toBe("CATEGORIA_NAO_ENCONTRADA");
  });

  test("estoque mínimo negativo -> 400", async () => {
    const r = await criarProdutoViaApi(token, { codigo: `TESTE-PROD-${sufixo()}`, categoriaId, estoqueMinimo: -1 });
    expect(r.status).toBe(400);
  });

  test("estoque mínimo decimal -> 400 (espera inteiro)", async () => {
    const r = await criarProdutoViaApi(token, { codigo: `TESTE-PROD-${sufixo()}`, categoriaId, estoqueMinimo: 2.5 });
    expect(r.status).toBe(400);
  });

  test("unidade inválida -> 400", async () => {
    const r = await criarProdutoViaApi(token, { codigo: `TESTE-PROD-${sufixo()}`, categoriaId, unidade: "XX" });
    expect(r.status).toBe(400);
  });

  test("possuiValidade não booleano -> 400", async () => {
    const r = await criarProdutoViaApi(token, { codigo: `TESTE-PROD-${sufixo()}`, categoriaId, possuiValidade: "sim" });
    expect(r.status).toBe(400);
  });

  test("campo extra no payload -> 400", async () => {
    const r = await criarProdutoViaApi(token, {
      codigo: `TESTE-PROD-${sufixo()}`,
      categoriaId,
      precoVenda: 99.99,
    });
    expect(r.status).toBe(400);
  });
});
describe("Produtos - listagem e filtros", () => {
  test("retorna lista de produtos com atributos esperados", async () => {
    const resultado = await requisitar("/api/produtos", { token });
    expect(resultado.status).toBe(200);
    expect(resultado.corpo.sucesso).toBe(true);
    expect(Array.isArray(resultado.corpo.dados)).toBe(true);
    const produto = resultado.corpo.dados[0];
    expect(produto).toHaveProperty("id");
    expect(produto).toHaveProperty("sku");
    expect(produto).toHaveProperty("estoque");
    expect(produto).toHaveProperty("estoqueMinimo");
    expect(produto).toHaveProperty("status");
  });

  test("listar categorias retorna array de categorias ativas", async () => {
    const resultado = await requisitar("/api/produtos/categorias", { token });
    expect(resultado.status).toBe(200);
    expect(Array.isArray(resultado.corpo.categorias)).toBe(true);
    expect(resultado.corpo.categorias.length).toBeGreaterThan(0);
  });

  test("filtro statusEstoque SEM_ESTOQUE retorna produtos com estoque 0", async () => {
    const resultado = await requisitar("/api/produtos?statusEstoque=SEM_ESTOQUE", { token });
    expect(resultado.status).toBe(200);
    for (const produto of resultado.corpo.dados) {
      expect(String(produto.status)).toBe("SEM_ESTOQUE");
    }
  });

  test("statusEstoque inválido -> 400", async () => {
    const resultado = await requisitar("/api/produtos?statusEstoque=INEXISTENTE", { token });
    expect(resultado.status).toBe(400);
  });

  test("parâmetro desconhecido -> 400", async () => {
    const resultado = await requisitar("/api/produtos?outrocampo=1", { token });
    expect(resultado.status).toBe(400);
  });

  test("busca filtra por nome ou SKU", async () => {
    const criado = await criarProdutoViaApi(token, {
      codigo: `TESTE-PROD-FRALDA-${sufixo()}`,
      nome: "Fralda Babycare de teste",
      categoriaId: await categoriaValida(),
    });
    expect(criado.status).toBe(201);

    const resultado = await requisitar("/api/produtos?busca=Fralda Babycare", { token });
    expect(resultado.status).toBe(200);
    expect(resultado.corpo.dados.length).toBeGreaterThan(0);
  });

  test("produto recém-criado aparece no início da primeira página", async () => {
    const codigo = `TESTE-PROD-NOVO-${sufixo()}`;
    const criado = await criarProdutoViaApi(token, {
      codigo,
      nome: "Produto recém-cadastrado",
      categoriaId: await categoriaValida(),
    });
    expect(criado.status).toBe(201);

    const resultado = await requisitar("/api/produtos?pagina=1&limite=20", { token });
    expect(resultado.status).toBe(200);
    expect(resultado.corpo.dados[0].sku).toBe(codigo);
  });
});

describe("Produtos - edição e inativação", () => {
  test("bloqueia a desativação de produto que ainda possui saldo", async () => {
    const codigo = `TESTE-PROD-SALDO-${sufixo()}`;
    const criado = await criarProdutoViaApi(token, {
      codigo,
      nome: "Produto com saldo ativo",
      categoriaId: await categoriaValida(),
    });
    expect(criado.status).toBe(201);
    const produtoId = criado.corpo.produto.id;

    try {
      const entrada = await requisitar("/api/recebimentos", {
        metodo: "POST",
        token,
        corpo: {
          tipo: "ENTRADA",
          produtoId,
          quantidade: 30,
          numeroLote: `LOTE-${sufixo()}`,
        },
      });
      expect(entrada.status).toBe(201);

      const desativar = await requisitar(`/api/produtos/${produtoId}/desativar`, {
        metodo: "PATCH",
        token,
      });
      expect(desativar.status).toBe(409);
      expect(desativar.corpo.codigo).toBe("PRODUTO_COM_ESTOQUE");

      const lista = await requisitar(`/api/produtos?busca=${codigo}`, { token });
      expect(lista.corpo.dados.some((produto) => produto.id === produtoId)).toBe(true);
    } finally {
      await executar("DELETE FROM movimentacoes WHERE produto_id = ?", [produtoId]);
      await executar("DELETE FROM lotes WHERE produto_id = ?", [produtoId]);
      await executar("DELETE FROM produtos WHERE id = ?", [produtoId]);
    }
  });

  test("PATCH atualiza produto e rota de desativação faz inativação lógica", async () => {
    const criado = await criarProdutoViaApi(token, {
      codigo: `TESTE-PROD-EDITAR-${sufixo()}`,
      nome: "Produto antes da edição",
      categoriaId: await categoriaValida(),
    });
    expect(criado.status).toBe(201);

    const patch = await requisitar(`/api/produtos/${criado.corpo.produto.id}`, {
      metodo: "PATCH",
      token,
      corpo: { nome: "Produto depois da edição" },
    });
    expect(patch.status).toBe(200);
    expect(patch.corpo.produto.nome).toBe("Produto depois da edição");

    const desativar = await requisitar(
      `/api/produtos/${criado.corpo.produto.id}/desativar`,
      { metodo: "PATCH", token },
    );
    expect(desativar.status).toBe(200);
    expect(desativar.corpo.sucesso).toBe(true);

    const del = await requisitar(`/api/produtos/${criado.corpo.produto.id}`, {
      metodo: "DELETE",
      token,
    });
    expect(del.status).toBe(404);
  });
});