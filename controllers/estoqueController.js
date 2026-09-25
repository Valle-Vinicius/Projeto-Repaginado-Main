// controllers/estoqueController.js
// recebe a requisicao, chama o service
// e devolve a resposta.
// regras de negocio ficam no service.

const estoqueService = require('../services/estoqueService');

// -------------------------------------------
// GET /estoque
// -------------------------------------------
async function listarEstoque(req, res) {
    try {
        const {
            codigo,
            nome,
            categoria_id
        } = req.query;

        const estoque = await estoqueService.listarEstoque({
            codigo,
            nome,
            categoria_id
        });

        return res.status(200).json({
            sucesso: true,
            total: estoque.length,
            estoque
        });

    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// GET /estoque/produto/:id
// -------------------------------------------
async function buscarEstoquePorProduto(req, res) {
    try {
        const { id } = req.params;

        const estoque = await estoqueService.buscarEstoquePorProduto(id);

        return res.status(200).json({
            sucesso: true,
            estoque
        });

    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// GET /estoque/produto/:id/lotes
// -------------------------------------------
async function listarLotesPorProduto(req, res) {
    try {
        const { id } = req.params;

        const lotes = await estoqueService.listarLotesPorProduto(id);

        return res.status(200).json({
            sucesso: true,
            total: lotes.length,
            lotes
        });

    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// GET /estoque/validade?dias=30
// -------------------------------------------
async function listarProximosDoVencimento(req, res) {
    try {
        const { dias } = req.query;

        const produtos = await estoqueService.listarProximosDoVencimento(
            dias || 30
        );

        return res.status(200).json({
            sucesso: true,
            total: produtos.length,
            produtos
        });

    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// GET /estoque/vencidos
// -------------------------------------------
async function listarVencidos(req, res) {
    try {
        const produtos = await estoqueService.listarVencidos();

        return res.status(200).json({
            sucesso: true,
            total: produtos.length,
            produtos
        });

    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// GET /estoque/fifo/:produtoId
// -------------------------------------------
async function listarFIFO(req, res) {
    try {
        const { produtoId } = req.params;

        const resultado = await estoqueService.listarFIFO(produtoId);

        return res.status(200).json({
            sucesso: true,
            ...resultado
        });

    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// GET /estoque/especiais
// -------------------------------------------
async function listarProdutosEspeciais(req, res) {
    try {
        const produtos = await estoqueService.listarProdutosEspeciais();

        return res.status(200).json({
            sucesso: true,
            total: produtos.length,
            produtos
        });

    } catch (erro) {
        return tratarErro(erro, res);
    }
}

// -------------------------------------------
// TRATAMENTO DE ERROS
// -------------------------------------------
function tratarErro(erro, res) {
    console.error('Erro no estoque:', erro.message);

    if (erro.tipo === 'validacao') {
        return res.status(400).json({
            sucesso: false,
            mensagem: erro.message
        });
    }

    if (erro.tipo === 'nao_encontrado') {
        return res.status(404).json({
            sucesso: false,
            mensagem: erro.message
        });
    }

    return res.status(500).json({
        sucesso: false,
        mensagem: 'Erro interno no servidor'
    });
}

module.exports = {
    listarEstoque,
    buscarEstoquePorProduto,
    listarLotesPorProduto,
    listarProximosDoVencimento,
    listarVencidos,
    listarFIFO,
    listarProdutosEspeciais
};

