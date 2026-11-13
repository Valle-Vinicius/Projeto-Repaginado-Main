"use strict";

const mockConexao = { execute: jest.fn() };

jest.mock("../../backend/config/database", () => ({
  executarQuery: jest.fn(),
  executarTransacao: (callback) => callback(mockConexao),
}));

const estoqueRepository = require("../../backend/repositories/estoqueRepository");

function linhas(rows) {
  return [rows];
}

function produto(possuiValidade = true) {
  return linhas([
    {
      id: 1,
      nome: "Produto de teste",
      codigo: "TESTE-1",
      unidade: "UN",
      possuiValidade,
    },
  ]);
}

function erroDeRejeicao(promise, statusCode, codigo) {
  return expect(promise).rejects.toMatchObject({ statusCode, codigo });
}

beforeEach(() => {
  mockConexao.execute.mockReset();
});

describe("Regras de validade no repository de estoque", () => {
  test("bloqueia saída quando só há lote vencido e informa descarte", async () => {
    mockConexao.execute
      .mockResolvedValueOnce(produto())
      .mockResolvedValueOnce(linhas([]))
      .mockResolvedValueOnce(
        linhas([{ quantidadeVencida: 8, quantidadeSemValidade: 0 }]),
      );

    await erroDeRejeicao(
      estoqueRepository.registrarSaida({ produtoId: 1, quantidade: 5 }),
      422,
      "LOTE_VENCIDO",
    );

    expect(mockConexao.execute.mock.calls[1][0]).toContain(
      "data_validade >= CURRENT_DATE",
    );
    expect(mockConexao.execute.mock.calls[2][0]).toContain(
      "data_validade < CURRENT_DATE",
    );
  });

  test("rejeita entrada sem validade em produto controlado", async () => {
    mockConexao.execute.mockResolvedValueOnce(produto(true));

    await erroDeRejeicao(
      estoqueRepository.registrarEntrada({ produtoId: 1, quantidade: 1 }),
      400,
      "DATA_VALIDADE_OBRIGATORIA",
    );

    expect(mockConexao.execute).toHaveBeenCalledTimes(1);
  });

  test("rejeita entrada com data vencida", async () => {
    mockConexao.execute
      .mockResolvedValueOnce(produto())
      .mockResolvedValueOnce(linhas([{ validadeVencida: true }]));

    await erroDeRejeicao(
      estoqueRepository.registrarEntrada({
        produtoId: 1,
        quantidade: 1,
        dataValidade: "2020-01-01",
      }),
      400,
      "DATA_VALIDADE_VENCIDA",
    );

    expect(mockConexao.execute).toHaveBeenCalledTimes(2);
  });

  test("não permite reentrada que altere validade do lote", async () => {
    mockConexao.execute
      .mockResolvedValueOnce(produto())
      .mockResolvedValueOnce(linhas([{ validadeVencida: false }]))
      .mockResolvedValueOnce(linhas([{ id: 9, validadeDiferente: true }]));

    await erroDeRejeicao(
      estoqueRepository.registrarEntrada({
        produtoId: 1,
        quantidade: 1,
        numeroLote: "LOTE-1",
        dataValidade: "2099-12-31",
      }),
      409,
      "VALIDADE_LOTE_DIVERGENTE",
    );

    expect(mockConexao.execute).toHaveBeenCalledTimes(3);
  });

  test("exige validade no aumento por ajuste de produto controlado", async () => {
    mockConexao.execute
      .mockResolvedValueOnce(produto())
      .mockResolvedValueOnce(linhas([]));

    await erroDeRejeicao(
      estoqueRepository.registrarAjuste({
        produtoId: 1,
        quantidadeNova: 5,
        numeroLote: "LOTE-CONTROLADO",
      }),
      400,
      "AJUSTE_EXIGE_LOTE_COM_VALIDADE",
    );
  });

  test("exige lote em qualquer aumento por ajuste", async () => {
    mockConexao.execute
      .mockResolvedValueOnce(produto(false))
      .mockResolvedValueOnce(linhas([]));

    await erroDeRejeicao(
      estoqueRepository.registrarAjuste({
        produtoId: 1,
        quantidadeNova: 5,
        observacao: "Correção de inventário",
      }),
      400,
      "AJUSTE_LOTE_OBRIGATORIO",
    );
    expect(mockConexao.execute).toHaveBeenCalledTimes(2);
  });

  test("adiciona saldo ao lote informado quando a validade coincide", async () => {
    const auditoriaRepository = {
      registrarNaConexao: jest.fn().mockResolvedValue({ id: 21 }),
    };
    mockConexao.execute
      .mockResolvedValueOnce(produto(false))
      .mockResolvedValueOnce(linhas([]))
      .mockResolvedValueOnce(linhas([{ validadeVencida: false }]))
      .mockResolvedValueOnce(linhas([{ id: 12, ativo: true, validadeDiferente: false }]))
      .mockResolvedValueOnce(linhas([]))
      .mockResolvedValueOnce(linhas([{ id: 30 }]));

    const resultado = await estoqueRepository.registrarAjuste({
      produtoId: 1,
      quantidadeNova: 5,
      usuarioId: 2,
      observacao: "Correção após conferência",
      numeroLote: "LOTE-AJUSTE-1",
      dataValidade: "2099-12-31",
      auditoriaRepository,
    });

    expect(resultado.diferenca).toBe(5);
    expect(mockConexao.execute.mock.calls[3][0]).toContain(
      "validadeDiferente",
    );
    expect(mockConexao.execute.mock.calls[3][1]).toEqual([
      "2099-12-31",
      1,
      "LOTE-AJUSTE-1",
    ]);
    expect(mockConexao.execute.mock.calls[4][0]).toContain(
      "quantidade_atual = quantidade_atual + ?",
    );
    expect(auditoriaRepository.registrarNaConexao).toHaveBeenCalled();
  });
});
