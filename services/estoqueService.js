
// services/estoqueService.js
// regras de negocio relacionadas ao estoque.

const estoqueRepository = require('../repositories/estoqueRepository');

// -------------------------------------------
// LISTAR ESTOQUE
// -------------------------------------------
async function listarEstoque(filtros) {
    return await estoqueRepository.listarEstoque(filtros);
}

// -------------------------------------------
// BUSCAR ESTOQUE POR PRODUTO
// -------------------------------------------
async function buscarEstoquePorProduto(produtoId) {
    if (!produtoId || isNaN(produtoId)) {
        const erro = new Error('ID do produto invalido');
        erro.tipo = 'validacao';
        throw erro;
    }

    const estoque = await estoqueRepository.buscarEstoquePorProduto(produtoId);

    if (!estoque) {
        const erro = new Error('Produto nao encontrado');
        erro.tipo = 'nao_encontrado';
        throw erro;
    }

    return estoque;
}

// -------------------------------------------
// LISTAR LOTES
// -------------------------------------------
async function listarLotesPorProduto(produtoId) {
    if (!produtoId || isNaN(produtoId)) {
        const erro = new Error('ID do produto invalido');
        erro.tipo = 'validacao';
        throw erro;
    }

    const estoque = await estoqueRepository.buscarEstoquePorProduto(produtoId);

    if (!estoque) {
        const erro = new Error('Produto nao encontrado');
        erro.tipo = 'nao_encontrado';
        throw erro;
    }

    return await estoqueRepository.listarLotesPorProduto(produtoId);
}

// -------------------------------------------
// PRÓXIMOS DO VENCIMENTO
// -------------------------------------------
async function listarProximosDoVencimento(dias = 30) {
    dias = Number(dias);

    if (!Number.isInteger(dias) || dias < 0) {
        const erro = new Error('Quantidade de dias invalida');
        erro.tipo = 'validacao';
        throw erro;
    }

    return await estoqueRepository.listarProximosDoVencimento(dias);
}

// -------------------------------------------
// VENCIDOS
// -------------------------------------------
async function listarVencidos() {
    return await estoqueRepository.listarVencidos();
}

// -------------------------------------------
// FIFO
// -------------------------------------------
async function listarFIFO(produtoId) {
    if (!produtoId || isNaN(produtoId)) {
        const erro = new Error('ID do produto invalido');
        erro.tipo = 'validacao';
        throw erro;
    }

    const estoque = await estoqueRepository.buscarEstoquePorProduto(produtoId);

    if (!estoque) {
        const erro = new Error('Produto nao encontrado');
        erro.tipo = 'nao_encontrado';
        throw erro;
    }

    const lotes = await estoqueRepository.listarFIFO(produtoId);

    return {
        produto: estoque,
        lotes
    };
}

// -------------------------------------------
// PRODUTOS ESPECIAIS
// -------------------------------------------
async function listarProdutosEspeciais() {
    return await estoqueRepository.listarProdutosEspeciais();
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
