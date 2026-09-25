const localizacaoService = require('../services/localizacaoService');


async function listar(req, res, next) {
  try {
    const localizacoes = await localizacaoService.listarLocalizacoes(req.query);
    return res.status(200).json({
      sucesso: true,
      dados: localizacoes
    });
  } catch (error) {
    next(error);
  }
}


async function obterPorId(req, res, next) {
  try {
    const { id } = req.params;
    const localizacao = await localizacaoService.obterLocalizacaoPorId(id);
    
    return res.status(200).json({
      sucesso: true,
      dados: localizacao
    });
  } catch (error) {
    next(error);
  }
}


async function criar(req, res, next) {
  try {
    const novaLocalizacao = await localizacaoService.criarLocalizacao(req.body);
    
    return res.status(201).json({
      sucesso: true,
      mensagem: 'Localização criada com sucesso.',
      dados: novaLocalizacao
    });
  } catch (error) {
    next(error);
  }
}

// Atualizar dados de uma localização existente
async function atualizar(req, res, next) {
  try {
    const { id } = req.params;
    const localizacaoAtualizada = await localizacaoService.atualizarLocalizacao(id, req.body);
    
    return res.status(200).json({
      sucesso: true,
      mensagem: 'Localização atualizada com sucesso.',
      dados: localizacaoAtualizada
    });
  } catch (error) {
    next(error);
  }
}

// Remover / Inativar uma localização
async function deletar(req, res, next) {
  try {
    const { id } = req.params;
    await localizacaoService.deletarLocalizacao(id);
    
    return res.status(200).json({
      sucesso: true,
      mensagem: 'Localização removida com sucesso.'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listar,
  obterPorId,
  criar,
  atualizar,
  deletar
};