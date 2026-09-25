const produtoRepository = require('../repositories/produtoRepository');
const { validarProdutoPayload } = require('../validators/produtoValidator');

const PERFIS_PRODUTO = Object.freeze([
  'OPERADOR_ESTOQUE',
  'GERENTE',
  'ADMINISTRADOR'
]);

const STATUS_ESTOQUE_PERMITIDOS = new Set(['NORMAL', 'BAIXO', 'SEM_ESTOQUE']);

function erroComStatus(mensagem, statusCode = 400, code = 'VALIDATION_ERROR', fields = {}) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  erro.code = code;
  erro.fields = fields;
  return erro;
}

function validarBusca(busca) {
  if (busca == null || busca === '') return '';
  if (typeof busca !== 'string') {
    throw erroComStatus('O parâmetro busca deve ser um texto.', 400, 'BUSCA_TIPO_INVALIDO');
  }

  const texto = busca.trim();
  if (texto.length > 100) {
    throw erroComStatus('O parâmetro busca ultrapassa o limite permitido.', 400, 'BUSCA_MUITO_LONGA');
  }

  return texto;
}

function validarCategoriaFiltro(categoriaId) {
  if (categoriaId == null || categoriaId === '') return null;
  if (typeof categoriaId !== 'string' && typeof categoriaId !== 'number') {
    throw erroComStatus('O parâmetro categoriaId deve ser numérico.', 400, 'CATEGORIA_TIPO_INVALIDO');
  }

  const numero = Number(categoriaId);
  if (!Number.isInteger(numero) || numero < 1) {
    throw erroComStatus('O parâmetro categoriaId é inválido.', 400, 'CATEGORIA_INVALIDA');
  }

  return numero;
}

function normalizarProduto(produto) {
  const estoque = Number(produto.estoque ?? 0);
  const estoqueMinimo = Number(produto.estoqueMinimo ?? 0);
  if (!Number.isFinite(estoque) || estoque < 0 || !Number.isFinite(estoqueMinimo) || estoqueMinimo < 0) {
    throw erroComStatus('O banco retornou um estoque inválido.', 500, 'DADO_PRODUTO_INVALIDO');
  }

  return {
    id: Number(produto.id),
    sku: String(produto.sku || ''),
    nome: String(produto.nome || ''),
    descricao: produto.descricao == null ? null : String(produto.descricao),
    categoriaId: produto.categoriaId == null ? null : Number(produto.categoriaId),
    categoria: String(produto.categoria || 'Sem categoria'),
    unidade: String(produto.unidade || 'UN'),
    possuiValidade: Boolean(produto.possuiValidade),
    estoque,
    estoqueMinimo,
    status: String(produto.status || 'SEM_ESTOQUE'),
    statusProduto: String(produto.statusProduto || 'ATIVO'),
    criadoEm: produto.criadoEm || null,
    atualizadoEm: produto.atualizadoEm || null,
    ultimaMovimentacao: produto.ultimaMovimentacao || null
  };
}

function validarFiltros(filtros = {}) {
  const camposPermitidos = new Set(['busca', 'categoriaId', 'statusEstoque']);
  const desconhecidos = Object.keys(filtros).filter((campo) => !camposPermitidos.has(campo));
  if (desconhecidos.length > 0) {
    throw erroComStatus(
      `Parâmetro não permitido: ${desconhecidos[0]}.`,
      400,
      'PARAMETRO_NAO_PERMITIDO'
    );
  }

  const statusEstoque = filtros.statusEstoque || '';
  if (statusEstoque && !STATUS_ESTOQUE_PERMITIDOS.has(statusEstoque)) {
    throw erroComStatus('O filtro de estoque é inválido.', 400, 'STATUS_ESTOQUE_INVALIDO');
  }

  return {
    busca: validarBusca(filtros.busca),
    categoriaId: validarCategoriaFiltro(filtros.categoriaId),
    statusEstoque
  };
}

async function listarProdutos(filtros = {}) {
  const filtrosValidados = validarFiltros(filtros);
  const produtos = await produtoRepository.buscarProdutos(filtrosValidados);
  const normalizados = produtos.map(normalizarProduto);

  if (!filtrosValidados.statusEstoque) return normalizados;
  return normalizados.filter((produto) => produto.status === filtrosValidados.statusEstoque);
}

async function listarCategorias() {
  const categorias = await produtoRepository.buscarCategorias();
  return categorias.map((categoria) => ({
    id: Number(categoria.id),
    nome: String(categoria.nome)
  }));
}

async function criarProduto(payload) {
  const produtoValidado = validarProdutoPayload(payload);
  const categoria = await produtoRepository.buscarCategoriaAtiva(produtoValidado.categoriaId);

  if (!categoria) {
    throw erroComStatus(
      'A categoria selecionada não existe ou está inativa.',
      404,
      'CATEGORIA_NAO_ENCONTRADA',
      { categoriaId: 'Selecione uma categoria ativa.' }
    );
  }

  const id = await produtoRepository.criarProduto(produtoValidado);
  const produto = await produtoRepository.buscarProdutoPorId(id);

  if (!produto) {
    throw erroComStatus('O produto foi criado, mas não pôde ser recuperado.', 500, 'PRODUTO_NAO_RECUPERADO');
  }

  return normalizarProduto(produto);
}

module.exports = {
  listarProdutos,
  listarCategorias,
  criarProduto,
  validarFiltros,
  PERFIS_PRODUTO
};
