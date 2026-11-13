"use strict";

jest.mock("../../backend/config/database", () => ({
  executarQuery: jest.fn(),
}));

const { executarQuery } = require("../../backend/config/database");
const dashboardRepository = require("../../backend/repositories/dashboardRepository");
const estoqueRepository = require("../../backend/repositories/estoqueRepository");
const validadeRepository = require("../../backend/repositories/validadeRepository");

beforeEach(() => {
  executarQuery.mockReset().mockResolvedValue([]);
});

describe("Consultas de validade e datas", () => {
  test("recebimentos retornam validade como data sem fuso", async () => {
    await estoqueRepository.buscarRecebimentos();
    expect(executarQuery.mock.calls[0][0]).toContain(
      "TO_CHAR(l.data_validade, 'YYYY-MM-DD') AS dataValidade",
    );
  });

  test.each([
    [
      "buscarValidadesProximas",
      () => dashboardRepository.buscarValidadesProximas(30),
    ],
    ["buscarVencidos", () => dashboardRepository.buscarVencidos()],
  ])("%s retorna validade como data sem fuso", async (_nome, consultar) => {
    await consultar();
    expect(executarQuery.mock.calls[0][0]).toContain(
      "TO_CHAR(l.data_validade, 'YYYY-MM-DD') AS dataValidade",
    );
    expect(executarQuery.mock.calls[0][0]).toContain("l.quantidade_atual > 0");
  });

  test("a listagem e o resumo ignoram lotes sem saldo", async () => {
    await validadeRepository.listarValidades({});
    const consultaLista = executarQuery.mock.calls[0][0];
    expect(consultaLista).toContain("l.quantidade_atual > 0");

    await validadeRepository.obterResumo();
    const consultaResumo = executarQuery.mock.calls[1][0];
    expect(consultaResumo).toContain("l.quantidade_atual > 0");
  });

  test("o resumo de validade do dashboard ignora lotes sem saldo", async () => {
    await dashboardRepository.buscarResumoValidades();
    expect(executarQuery.mock.calls[0][0]).toContain("l.quantidade_atual > 0");
  });
});
