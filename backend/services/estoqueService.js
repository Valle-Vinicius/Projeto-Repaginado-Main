const estoqueRepository = require("../repositories/estoqueRepository");
const auditoriaRepository = require("../repositories/auditoriaRepository");
const expedicaoValidator = require("../validators/expedicaoValidator");
const recebimentoValidator = require("../validators/recebimentoValidator");

const PERFIS_ESTOQUE = ["OPERADOR_ESTOQUE", "GERENTE", "ADMINISTRADOR"];

function erroValidacao(mensagem, codigo = "DADOS_INVALIDOS") {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  erro.codigo = codigo;
  return erro;
}
function idUsuario(usuario) {
  return Number(usuario?.id || usuario?.usuarioId || 0) || null;
}

function normalizarProduto(produto) {
  const estoque = Number(produto.estoqueAtual ?? produto.estoque ?? 0);
  const estoqueMinimo = Number(produto.estoqueMinimo ?? 0);
  return {
    ...produto,
    id: Number(produto.id),
    nome: String(produto.nome || "Produto sem nome"),
    codigo: String(produto.codigo || "Sem código"),
    categoria: String(produto.categoria || "Sem categoria"),
    estoque,
    estoqueAtual: estoque,
    estoqueMinimo,
    status:
      estoque <= 0
        ? "SEM_ESTOQUE"
        : estoque <= estoqueMinimo
          ? "BAIXO"
          : "NORMAL",
    statusProduto: "ATIVO",
    possuiValidade: Boolean(produto.possuiValidade),
    unidade: String(produto.unidade || "UN"),
  };
}

async function obterEstoqueCompleto() {
  const [produtosBrutos, categorias, localizacoes, movimentacoes] =
    await Promise.all([
      estoqueRepository.buscarProdutosComSaldo(),
      estoqueRepository.buscarCategorias(),
      estoqueRepository.buscarLocalizacoes(),
      estoqueRepository.buscarMovimentacoes({ limite: 200 }),
    ]);
  const produtos = produtosBrutos.map(normalizarProduto);
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const movimentacoesNormalizadas = movimentacoes.map((item) => ({
    ...item,
    quantidade: Number(item.quantidade || 0),
  }));
  const movimentacoesHoje = movimentacoesNormalizadas.filter(
    (item) => new Date(item.data) >= hoje,
  ).length;
  return {
    resumo: {
      estoqueTotal: produtos.reduce((total, item) => total + item.estoque, 0),
      estoqueBaixo: produtos.filter((item) => item.status === "BAIXO").length,
      semEstoque: produtos.filter((item) => item.status === "SEM_ESTOQUE")
        .length,
      movimentacoesHoje,
    },
    categorias,
    produtos,
    movimentacoes: movimentacoesNormalizadas,
    localizacoes,
  };
}

async function listarProdutos() {
  const produtos = await estoqueRepository.buscarProdutosComSaldo();
  return produtos.map(normalizarProduto);
}
async function listarExpedicoes() {
  const itens = await estoqueRepository.buscarExpedicoes({ limite: 500 });
  return itens.map((x) => ({
    ...x,
    id: Number(x.id),
    produtoId: Number(x.produtoId),
    quantidade: Number(x.quantidade || 0),
  }));
}
async function listarRecebimentos() {
  const itens = await estoqueRepository.buscarRecebimentos({ limite: 500 });
  return itens.map((x) => ({
    ...x,
    id: Number(x.id),
    produtoId: Number(x.produtoId),
    quantidade: Number(x.quantidade || 0),
    saldoLote: Number(x.saldoLote || 0),
  }));
}
async function registrarMovimentacao(dados, usuario) {
  const tipo = String(dados.tipo || "").trim().toUpperCase();
  const usuarioId = idUsuario(usuario);

  if (tipo === "SAIDA") {
    const saida = expedicaoValidator.validarSaida(dados);
    return estoqueRepository.registrarSaida({
      ...saida,
      usuarioId,
      auditoriaRepository,
    });
  }

  if (tipo === "ENTRADA") {
    const entrada = recebimentoValidator.validarEntrada(dados);
    return estoqueRepository.registrarEntrada({
      ...entrada,
      usuarioId,
      auditoriaRepository,
    });
  }

  throw erroValidacao("Tipo de movimentação inválido. Use ENTRADA ou SAIDA.");
}

module.exports = {
  PERFIS_ESTOQUE,
  listarProdutos,
  obterEstoqueCompleto,
  listarExpedicoes,
  listarRecebimentos,
  registrarMovimentacao,
};
