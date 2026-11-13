"use strict";

const mockConexao = { execute: jest.fn() };

jest.mock("../../backend/config/database", () => ({
  executarQuery: jest.fn(),
  executarTransacao: (callback) => callback(mockConexao),
}));
jest.mock("../../backend/repositories/auditoriaRepository", () => ({
  registrarNaConexao: jest.fn().mockResolvedValue({ id: 12 }),
}));

const produtoRepository = require("../../backend/repositories/produtoRepository");
const auditoriaRepository = require("../../backend/repositories/auditoriaRepository");

function linhas(rows) {
  return [rows];
}

beforeEach(() => {
  mockConexao.execute.mockReset();
  auditoriaRepository.registrarNaConexao.mockClear();
});

describe("Desativação segura de produto", () => {
  test("bloqueia produto com saldo em lote ativo dentro da transação", async () => {
    mockConexao.execute
      .mockResolvedValueOnce(linhas([{ id: 1 }]))
      .mockResolvedValueOnce(linhas([{ id: 7 }]));

    await expect(produtoRepository.desativarProduto(1)).rejects.toMatchObject({
      statusCode: 409,
      codigo: "PRODUTO_COM_ESTOQUE",
    });

    expect(mockConexao.execute.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(mockConexao.execute.mock.calls[1][0]).toContain(
      "quantidade_atual > 0",
    );
    expect(mockConexao.execute).toHaveBeenCalledTimes(2);
  });

  test("desativa produto sem saldo depois de bloquear sua linha", async () => {
    mockConexao.execute
      .mockResolvedValueOnce(linhas([{ id: 1, codigo: "SKU-1", nome: "Produto" }]))
      .mockResolvedValueOnce(linhas([]))
      .mockResolvedValueOnce(linhas([{ id: 1 }]));

    await expect(produtoRepository.desativarProduto(1, 5)).resolves.toBe(true);

    expect(mockConexao.execute.mock.calls[2][0]).toContain(
      "UPDATE produtos SET ativo = FALSE",
    );
    expect(auditoriaRepository.registrarNaConexao).toHaveBeenCalledWith(
      mockConexao,
      expect.objectContaining({
        usuarioId: 5,
        acao: "PRODUTO_INATIVADO",
        entidade: "PRODUTO",
        entidadeId: 1,
        detalhes: { codigo: "SKU-1", nome: "Produto" },
      }),
    );
  });
});
