// controllers/produtoController.js
const produtoService = require('../services/produtoService');

async function cadastrar(req, res) {
    try {
        const produto = await produtoService.cadastrarProduto(req.body);
        return res.status(201).json({
            mensagem: 'Produto cadastrado com sucesso',
            produto
        });
    } catch (erro) {
        return tratarErro(erro, res);
    }
}

async function listar(req, res) {
    try {
        const produtos = await produtoService.listarProdutos();
        return res.status(200).json({ produtos });
    } catch (erro) {
        return tratarErro(erro, res);
    }
}

async function buscarPorId(req, res) {
    try {
        const produto = await produtoService.buscarProduto(req.params.id);
        return res.status(200).json({ produto });
    } catch (erro) {
        return tratarErro(erro, res);
    }
}

async function atualizar(req, res) {
    try {
        const produto = await produtoService.atualizarProduto(req.params.id, req.body);
        return res.status(200).json({
            mensagem: 'Produto atualizado com sucesso',
            produto
        });
    } catch (erro) {
        return tratarErro(erro, res);
    }
}

async function remover(req, res) {
    try {
        await produtoService.removerProduto(req.params.id);
        return res.status(200).json({ mensagem: 'Produto removido com sucesso' });
    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// tratamento centralizado de erros do controller
// -------------------------------------------
function tratarErro(erro, res) {
    if (erro.name === 'ErroValidacao') {
        return res.status(400).json({
            mensagem: erro.message,
            campos: erro.campos
        });
    }

    console.error('Erro inesperado no produtoController:', erro);
    return res.status(500).json({
        mensagem: 'Erro interno ao processar a solicitação'
    });
}

module.exports = {
    cadastrar,
    listar,
    buscarPorId,
    atualizar,
    remover
};