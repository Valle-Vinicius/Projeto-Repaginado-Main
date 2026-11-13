"use strict";

jest.mock("../../backend/services/estoqueService", () => ({}));

const estoqueController = require("../../backend/controllers/estoqueController");

function criarResposta() {
  return {
    statusCode: null,
    corpo: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    json(corpo) {
      this.corpo = corpo;
      return this;
    },
  };
}

describe("Rotas de movimentação por tipo", () => {
  test("recebimentos rejeitam tipo SAIDA antes de chamar o service", async () => {
    const resposta = criarResposta();

    await estoqueController.registrarRecebimento(
      { body: { tipo: "SAIDA" } },
      resposta,
    );

    expect(resposta.statusCode).toBe(400);
    expect(resposta.corpo.codigo).toBe("TIPO_MOVIMENTACAO_INVALIDO");
  });

  test("expedições rejeitam tipo ENTRADA antes de chamar o service", async () => {
    const resposta = criarResposta();

    await estoqueController.registrarExpedicao(
      { body: { tipo: "ENTRADA" } },
      resposta,
    );

    expect(resposta.statusCode).toBe(400);
    expect(resposta.corpo.codigo).toBe("TIPO_MOVIMENTACAO_INVALIDO");
  });
});
