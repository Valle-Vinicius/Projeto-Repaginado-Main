const estoqueRepository = require("../repositories/estoqueRepository");
const auditoriaRepository = require("../repositories/auditoriaRepository");

const PERFIS_ESTOQUE = ["OPERADOR_ESTOQUE", "GERENTE", "ADMINISTRADOR"];

function erroValidacao(mensagem, codigo = "DADOS_INVALIDOS") {
  const erro = new Error(mensagem);
  erro.statusCode = 400;
  erro.codigo = codigo;
  return erro;
}
function numeroPositivo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero <= 0)
    throw erroValidacao(`Informe ${campo} com um valor maior que zero.`);
  return numero;
}
function textoObrigatorio(valor, campo, maximo = 150) {
  const texto = String(valor || "").trim();
  if (!texto) throw erroValidacao(`Informe ${campo}.`);
  if (texto.length > maximo)
    throw erroValidacao(`${campo} ultrapassa o limite permitido.`);
  return texto;
}
function idUsuario(usuario) {
  return Number(usuario?.id || usuario?.usuarioId || 0) || null;
}
function idProduto(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0)
    throw erroValidacao("Informe um produto válido.");
  return id;
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
  const tipo = String(dados.tipo || "").toUpperCase();
  const produtoId = idProduto(dados.produtoId);
  const quantidade = numeroPositivo(dados.quantidade, "a quantidade");
  const usuarioId = idUsuario(usuario);
  const documento = dados.documento
    ? String(dados.documento).trim().slice(0, 80)
    : null;
  const observacao = dados.observacao
    ? String(dados.observacao).trim().slice(0, 255)
    : null;

  if (tipo === "SAIDA") {
    return estoqueRepository.registrarSaida({
      produtoId,
      quantidade,
      usuarioId,
      destinatario: textoObrigatorio(dados.destinatario, "o destinatário"),
      destino: textoObrigatorio(dados.destino, "o destino"),
      documento,
      motivo: dados.motivo ? String(dados.motivo).trim().slice(0, 80) : null,
      observacao,
      auditoriaRepository,
    });
  }
  if (tipo === "ENTRADA") {
    return estoqueRepository.registrarEntrada({
      produtoId,
      quantidade,
      usuarioId,
      fornecedor: dados.fornecedor
        ? String(dados.fornecedor).trim().slice(0, 150)
        : null,
      documento,
      numeroLote: dados.numeroLote
        ? String(dados.numeroLote).trim().slice(0, 80)
        : null,
      dataValidade: dados.dataValidade || null,
      localizacaoId: dados.localizacaoId ? Number(dados.localizacaoId) : null,
      observacao,
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
