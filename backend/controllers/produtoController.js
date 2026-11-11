const produtoService = require('../services/produtoService');

function erroDeConexao(erro) {
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENETUNREACH',
  ].includes(erro.code || erro.codigo);
}

function responderErro(res, erro) {
  if (erro.code === '23505') {
    return res.status(409).json({
      sucesso: false,
      codigo: 'PRODUTO_DUPLICADO',
      mensagem: 'Já existe um produto com este SKU.',
    });
  }

  const statusCode = erro.statusCode || (erroDeConexao(erro) ? 503 : 500);
  const codigo =
    statusCode === 400
      ? erro.codigo || 'VALIDATION_ERROR'
      : statusCode === 404
        ? erro.codigo || 'RECURSO_NAO_ENCONTRADO'
        : statusCode === 503
          ? 'BANCO_INDISPONIVEL'
          : 'ERRO_PRODUTOS';

  const mensagem =
    statusCode === 400 || statusCode === 404
      ? erro.message
      : statusCode === 503
        ? 'O banco de dados está temporariamente indisponível.'
        : 'Não foi possível concluir a operação de produtos.';

  console.error('[Produtos]', {
    mensagem: erro.message,
    codigo: erro.codigo,
    statusCode,
  });

  const resposta = {
    sucesso: false,
    codigo,
    mensagem,
  };

  if (erro.campo && Object.keys(erro.campo).length > 0) {
    resposta.fields = erro.campo;
  }

  return res.status(statusCode).json(resposta);
}

async function listarProdutos(req, res) {
  try {
    const resultado = await produtoService.listarProdutos({
      busca: req.query.busca,
      categoriaId: req.query.categoriaId,
      statusEstoque: req.query.statusEstoque,
      pagina: req.query.pagina,
      limite: req.query.limite,
    });
    return res.status(200).json({ sucesso: true, ...resultado });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function listarCategorias(req, res) {
  try {
    const categorias = await produtoService.listarCategorias();
    return res.status(200).json({ sucesso: true, categorias });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function criarProduto(req, res) {
  try {
    const produto = await produtoService.criarProduto(req.body);
    return res.status(201).json({
      sucesso: true,
      mensagem: 'Produto cadastrado com sucesso.',
      produto,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function atualizarProduto(req, res) {
  try {
    return res.json({
      sucesso: true,
      produto: await produtoService.atualizarProduto(req.params.id, req.body || {}),
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

async function desativarProduto(req, res) {
  try {
    return res.json(await produtoService.desativarProduto(req.params.id));
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = {
  listarProdutos,
  listarCategorias,
  criarProduto,
  atualizarProduto,
  desativarProduto,
};
