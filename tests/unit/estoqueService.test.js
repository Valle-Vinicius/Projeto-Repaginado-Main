"use strict";

jest.mock("../../backend/repositories/estoqueRepository", () => ({
  registrarEntrada: jest.fn(),
  registrarSaida: jest.fn(),
  registrarAjuste: jest.fn(),
}));
jest.mock("../../backend/repositories/auditoriaRepository", () => ({}));

const estoqueRepository = require("../../backend/repositories/estoqueRepository");
const estoqueService = require("../../backend/services/estoqueService");

describe("Validação e registro de movimentações de estoque", () => {
  beforeEach(() => {
    estoqueRepository.registrarAjuste.mockReset().mockResolvedValue({});
    estoqueRepository.registrarEntrada.mockReset().mockResolvedValue({});
    estoqueRepository.registrarSaida.mockReset().mockResolvedValue({});
  });

  test("preserva motivo e observação na movimentação de entrada", async () => {
    await estoqueService.registrarMovimentacao(
      {
        tipo: "ENTRADA",
        produtoId: 1,
        quantidade: 2,
        motivo: "RECEBIMENTO",
        observacao: "Nota conferida",
      },
      { id: 2 },
    );

    expect(estoqueRepository.registrarEntrada).toHaveBeenCalledWith(
      expect.objectContaining({ observacao: "RECEBIMENTO — Nota conferida" }),
    );
  });

  test("preserva motivo e observação na movimentação de saída", async () => {
    await estoqueService.registrarMovimentacao(
      {
        tipo: "SAIDA",
        produtoId: 1,
        quantidade: 2,
        destinatario: "Unidade de teste",
        destino: "Sala A",
        motivo: "AJUSTE",
        observacao: "Conferência física",
      },
      { id: 2 },
    );

    expect(estoqueRepository.registrarSaida).toHaveBeenCalledWith(
      expect.objectContaining({ observacao: "AJUSTE — Conferência física" }),
    );
  });

  test("exige justificativa", async () => {
    await expect(
      estoqueService.ajustarEstoque(
        { produtoId: 1, quantidadeNova: 5, observacao: "  " },
        { id: 2 },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      codigo: "JUSTIFICATIVA_OBRIGATORIA",
    });
    expect(estoqueRepository.registrarAjuste).not.toHaveBeenCalled();
  });

  test("valida e encaminha lote, validade e justificativa", async () => {
    await estoqueService.ajustarEstoque(
      {
        produtoId: 1,
        quantidadeNova: 5,
        observacao: "Conferência física",
        numeroLote: "LOTE-1",
        dataValidade: "2099-12-31",
      },
      { id: 2 },
    );

    expect(estoqueRepository.registrarAjuste).toHaveBeenCalledWith(
      expect.objectContaining({
        produtoId: 1,
        quantidadeNova: 5,
        observacao: "Conferência física",
        numeroLote: "LOTE-1",
        dataValidade: "2099-12-31",
        usuarioId: 2,
      }),
    );
  });

  test("rejeita data de validade com formato inválido", async () => {
    await expect(
      estoqueService.ajustarEstoque(
        {
          produtoId: 1,
          quantidadeNova: 5,
          observacao: "Conferência física",
          numeroLote: "LOTE-1",
          dataValidade: "31/12/2099",
        },
        { id: 2 },
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(estoqueRepository.registrarAjuste).not.toHaveBeenCalled();
  });
});
