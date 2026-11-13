const produtoRepository = require('../repositories/produtoRepository');
const { validarProdutoPayload } = require('../validators/produtoValidator');

const PERFIS_PRODUTO = Object.freeze(['OPERADOR_ESTOQUE', 'GERENTE', 'ADMINISTRADOR']);

const STATUS_ESTOQUE_PERMITIDOS = new Set(['NORMAL', 'BAIXO', 'SEM_ESTOQUE']);

function erroComStatus(mensagem, statusCode = 400, codigo = 'VALIDATION_ERROR', campos = {}) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  erro.codigo = codigo;
  erro.campo = campos;
  return erro;
}

function validarBusca(busca) {
  if (busca === undefined || busca === null || busca === '') {
    return '';
  }
  if (typeof busca !== 'string') {
    throw erroComStatus('O parâmetro busca deve ser um texto.', 400, 'BUSCA_TIPO_INVALIDO');
  }

  const texto = busca.trim();
  if (texto.length > 100) {
    throw erroComStatus(
      'O parâmetro busca ultrapassa o limite permitido.',
      400,
      'BUSCA_MUITO_LONGA'
    );
  }

  return texto;
}

function validarCategoriaFiltro(categoriaId) {
  if (categoriaId === undefined || categoriaId === null || categoriaId === '') {
    return null;
  }
  if (typeof categoriaId !== 'string' && typeof categoriaId !== 'number') {
    throw erroComStatus(
      'O parâmetro categoriaId deve ser numérico.',
      400,
      'CATEGORIA_TIPO_INVALIDO'
    );
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
  if (
    !Number.isFinite(estoque) ||
    estoque < 0 ||
    !Number.isFinite(estoqueMinimo) ||
    estoqueMinimo < 0
  ) {
    throw erroComStatus('O banco retornou um estoque inválido.', 500, 'DADO_PRODUTO_INVALIDO');
  }

  return {
    id: Number(produto.id),
    sku: String(produto.sku || ''),
    nome: String(produto.nome || ''),
    descricao: produto.descricao === null ? null : String(produto.descricao),
    categoriaId: produto.categoriaId === null ? null : Number(produto.categoriaId),
    categoria: String(produto.categoria || 'Sem categoria'),
    unidade: String(produto.unidade || 'UN'),
    possuiValidade: Boolean(produto.possuiValidade),
    estoque,
    estoqueMinimo,
    status: String(produto.status || 'SEM_ESTOQUE'),
    statusProduto: String(produto.statusProduto || 'ATIVO'),
    criadoEm: produto.criadoEm || null,
    atualizadoEm: produto.atualizadoEm || null,
    ultimaMovimentacao: produto.ultimaMovimentacao || null,
  };
}

function validarFiltros(filtros = {}) {
  const camposPermitidos = new Set(['busca', 'categoriaId', 'statusEstoque', 'pagina', 'limite']);
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
    statusEstoque,
  };
}

async function listarProdutos(filtros = {}) {
  const filtrosValidados = validarFiltros(filtros);
  const pagina = Math.max(1, Number(filtros.pagina) || 1);
  const limite = Math.min(100, Math.max(1, Number(filtros.limite) || 20));

  const resultado = await produtoRepository.buscarProdutos({
    ...filtrosValidados,
    pagina,
    limite,
  });

  const normalizados = resultado.dados.map(normalizarProduto);

  if (!filtrosValidados.statusEstoque) {
    return {
      dados: normalizados,
      total: resultado.total,
      pagina: resultado.pagina,
      limite: resultado.limite,
      totalPaginas: resultado.totalPaginas,
    };
  }

  const filtrados = normalizados.filter(
    (produto) => produto.status === filtrosValidados.statusEstoque
  );
  return {
    dados: filtrados,
    total: filtrados.length,
    pagina: resultado.pagina,
    limite: resultado.limite,
    totalPaginas: Math.ceil(filtrados.length / limite),
  };
}

async function listarCategorias() {
  const categorias = await produtoRepository.buscarCategorias();
  return categorias.map((categoria) => ({
    id: Number(categoria.id),
    nome: String(categoria.nome),
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
    throw erroComStatus(
      'O produto foi criado, mas não pôde ser recuperado.',
      500,
      'PRODUTO_NAO_RECUPERADO'
    );
  }

  return normalizarProduto(produto);
}

async function atualizarProduto(id, payload) {
  const produtoId = Number(id);
  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    throw erroComStatus('Produto inválido.', 400, 'PRODUTO_INVALIDO');
  }

  const existente = await produtoRepository.buscarProdutoPorId(produtoId);
  if (!existente) {
    throw erroComStatus('Produto não encontrado.', 404, 'PRODUTO_NAO_ENCONTRADO');
  }

  // Valida apenas os campos enviados
  const campos = {};
  if (payload.nome !== undefined) {
    campos.nome = String(payload.nome).trim();
    if (campos.nome.length < 3 || campos.nome.length > 150) {
      throw erroComStatus('O nome deve ter entre 3 e 150 caracteres.', 400, 'NOME_INVALIDO');
    }
  }
  if (payload.descricao !== undefined) {
    campos.descricao =
      payload.descricao === '' || payload.descricao === null
        ? null
        : String(payload.descricao).trim();
  }
  if (payload.categoriaId !== undefined) {
    const categoria = await produtoRepository.buscarCategoriaAtiva(payload.categoriaId);
    if (!categoria) {
      throw erroComStatus('Categoria não encontrada ou inativa.', 404, 'CATEGORIA_NAO_ENCONTRADA');
    }
    campos.categoriaId = Number(payload.categoriaId);
  }
  if (payload.estoqueMinimo !== undefined) {
    const minimo = Number(payload.estoqueMinimo);
    if (!Number.isInteger(minimo) || minimo < 0) {
      throw erroComStatus('Estoque mínimo inválido.', 400, 'ESTOQUE_MINIMO_INVALIDO');
    }
    campos.estoqueMinimo = minimo;
  }
  if (payload.unidade !== undefined) {
    campos.unidade = String(payload.unidade).trim().toUpperCase();
  }
  if (payload.possuiValidade !== undefined) {
    campos.possuiValidade = Boolean(payload.possuiValidade);
  }

  const atualizado = await produtoRepository.atualizarProduto(produtoId, campos);
  if (!atualizado) {
    throw erroComStatus('Não foi possível atualizar o produto.', 500, 'PRODUTO_NAO_ATUALIZADO');
  }
  return normalizarProduto(atualizado);
}

async function desativarProduto(id) {
  const produtoId = Number(id);
  if (!Number.isInteger(produtoId) || produtoId <= 0) {
    throw erroComStatus('Produto inválido.', 400, 'PRODUTO_INVALIDO');
  }

  const desativado = await produtoRepository.desativarProduto(produtoId);
  if (!desativado) {
    throw erroComStatus('Produto não encontrado.', 404, 'PRODUTO_NAO_ENCONTRADO');
  }

  return { sucesso: true, mensagem: 'Produto desativado com sucesso.' };
}

module.exports = {
  listarProdutos,
  listarCategorias,
  criarProduto,
  atualizarProduto,
  desativarProduto,
  validarFiltros,
  PERFIS_PRODUTO,
};
