"use strict";

jest.mock("../../backend/repositories/dashboardRepository", () => ({
  buscarResumo: jest.fn(),
  buscarResumoMovimentacoes: jest.fn(),
  buscarResumoValidades: jest.fn(),
  buscarEstoqueBaixo: jest.fn(),
  buscarSemEstoque: jest.fn(),
  buscarValidadesProximas: jest.fn(),
  buscarVencidos: jest.fn(),
  buscarMovimentacoes: jest.fn(),
  buscarCategorias: jest.fn(),
  buscarAtividadesRecentes: jest.fn(),
  buscarProdutosMaisMovimentados: jest.fn(),
}));

const dashboardRepository = require("../../backend/repositories/dashboardRepository");
const dashboardService = require("../../backend/services/dashboardService");

beforeEach(() => {
  dashboardRepository.buscarResumo.mockResolvedValue({
    totalProdutos: 3,
    produtosAtivos: 3,
    estoqueTotal: 12,
    estoqueBaixo: 0,
    semEstoque: 0,
  });
  dashboardRepository.buscarResumoMovimentacoes.mockResolvedValue({
    movimentacoesPeriodo: 2,
    entradasPeriodo: 8,
    saidasPeriodo: 4,
    movimentacoesPeriodoAnterior: 1,
  });
  dashboardRepository.buscarResumoValidades.mockResolvedValue({
    ate7Dias: 0,
    ate30Dias: 0,
    de8a30Dias: 0,
    acima30Dias: 0,
    vencidos: 0,
    produtosPendentes: 0,
  });
  dashboardRepository.buscarEstoqueBaixo.mockResolvedValue([]);
  dashboardRepository.buscarSemEstoque.mockResolvedValue([]);
  dashboardRepository.buscarValidadesProximas.mockResolvedValue([]);
  dashboardRepository.buscarVencidos.mockResolvedValue([]);
  dashboardRepository.buscarMovimentacoes.mockResolvedValue([]);
  dashboardRepository.buscarCategorias.mockResolvedValue([]);
  dashboardRepository.buscarAtividadesRecentes.mockResolvedValue([]);
  dashboardRepository.buscarProdutosMaisMovimentados.mockResolvedValue([
    {
      id: 7,
      nome: "Fralda Babycare P",
      totalMovimentado: "14",
      entradas: "8",
      saidas: "6",
      ajustes: "0",
    },
  ]);
});

test("retorna os produtos mais movimentados normalizados para o dashboard", async () => {
  const dados = await dashboardService.obterDashboard({ periodo: "30d" });

  expect(dashboardRepository.buscarProdutosMaisMovimentados).toHaveBeenCalledWith("30d", 5);
  expect(dados.produtosMaisMovimentados).toEqual([
    {
      id: 7,
      nome: "Fralda Babycare P",
      totalMovimentado: 14,
      entradas: 8,
      saidas: 6,
      ajustes: 0,
    },
  ]);
});
