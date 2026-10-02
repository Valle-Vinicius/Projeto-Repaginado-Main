"use strict";
/**
 * TESTES DE PRODUTOS
 * Comportamento real de GET /api/produtos, GET /api/produtos/categorias
 * e POST /api/produtos.
 */

const { config } = require("../helpers/env");
const { iniciarServidor, encerrarServidor, requisitar, login } = require("../helpers/server");
const { criarProdutoViaApi, sufixo, limparPrefixo } = require("../helpers/fixtures");
const { consultar } = require("../helpers/db");

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
    expect(Array.isArray(resultado.corpo.produtos)).toBe(true);
    const produto = resultado.corpo.produtos[0];
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
    for (const produto of resultado.corpo.produtos) {
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
    const resultado = await requisitar("/api/produtos?busca=Fralda Babycare", { token });
    expect(resultado.status).toBe(200);
    expect(resultado.corpo.produtos.length).toBeGreaterThan(0);
  });
});

describe("Produtos - cobertura ausente (registro de lacuna)", () => {
  test("NÃO existe rota de edição/inativação/consulta por id de produto", async () => {
    // As rotas reais são apenas GET /, GET /categorias e POST /.
    // Este teste documenta a lacuna: não há endpoint para editar produto.
    const patch = await requisitar("/api/produtos/1", { metodo: "PATCH", token, corpo: { nome: "X" } });
    const del = await requisitar("/api/produtos/1", { metodo: "DELETE", token });
    // O servidor responde 404 ROTA_NAO_ENCONTRADA para rotas inexistentes.
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
  });
});