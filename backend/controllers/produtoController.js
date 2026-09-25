const produtoService = require('../services/produtoService');

function erroDeConexao(erro) {
  return [
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENETUNREACH',
    'PROTOCOL_CONNECTION_LOST',
    'ER_CON_COUNT_ERROR'
  ].includes(erro.code);
}

function responderErro(res, erro) {
  if (erro.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      sucesso: false,
      codigo: 'PRODUTO_DUPLICADO',
      mensagem: 'Já existe um produto com este SKU.'
    });
  }

  const statusCode = erro.statusCode || (erroDeConexao(erro) ? 503 : 500);
  const codigo = statusCode === 400
    ? erro.code || 'VALIDATION_ERROR'
    : statusCode === 404
      ? erro.code || 'RECURSO_NAO_ENCONTRADO'
      : statusCode === 503
        ? 'BANCO_INDISPONIVEL'
        : 'ERRO_PRODUTOS';

  const mensagem = statusCode === 400 || statusCode === 404
    ? erro.message
    : statusCode === 503
      ? 'O banco de dados está temporariamente indisponível.'
      : 'Não foi possível concluir a operação de produtos.';

  console.error('[Produtos]', {
    mensagem: erro.message,
    codigo: erro.code,
    statusCode,
    detalheMySQL: erro.sqlMessage
  });

  const resposta = {
    sucesso: false,
    codigo,
    mensagem
  };

  if (erro.fields && Object.keys(erro.fields).length > 0) {
    resposta.fields = erro.fields;
  }

  return res.status(statusCode).json(resposta);
}

async function listarProdutos(req, res) {
  try {
    const produtos = await produtoService.listarProdutos({
      busca: req.query.busca,
      categoriaId: req.query.categoriaId,
      statusEstoque: req.query.statusEstoque
    });
    return res.status(200).json({ sucesso: true, produtos });
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
      produto
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

module.exports = {
  listarProdutos,
  listarCategorias,
  criarProduto
};
