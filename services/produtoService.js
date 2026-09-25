// services/produtoService.js
const produtoRepository = require('../repositories/produtoRepository');

class ErroValidacao extends Error {
    constructor(mensagem, campos = {}) {
        super(mensagem);
        this.name = 'ErroValidacao';
        this.campos = campos; // { nomeCampo: 'mensagem específica' }
    }
}

function validarProduto(dados, { exigirCodigo = true } = {}) {
    const erros = {};

    if (exigirCodigo && (!dados.codigo || !dados.codigo.trim())) {
        erros.codigo = 'Código interno é obrigatório';
    }

    if (!dados.nome || dados.nome.trim().length < 2) {
        erros.nome = 'Nome do produto é obrigatório e precisa ter ao menos 2 caracteres';
    }

    if (dados.quantidade === undefined || dados.quantidade === null || dados.quantidade === '') {
        erros.quantidade = 'Quantidade em estoque é obrigatória';
    } else if (isNaN(dados.quantidade) || Number(dados.quantidade) < 0) {
        erros.quantidade = 'Quantidade precisa ser um número maior ou igual a zero';
    }

    if (dados.precoCusto !== undefined && dados.precoCusto !== null && dados.precoCusto !== '') {
        if (isNaN(dados.precoCusto) || Number(dados.precoCusto) < 0) {
            erros.precoCusto = 'Preço de custo inválido';
        }
    }

    if (dados.precoVenda !== undefined && dados.precoVenda !== null && dados.precoVenda !== '') {
        if (isNaN(dados.precoVenda) || Number(dados.precoVenda) < 0) {
            erros.precoVenda = 'Preço de venda inválido';
        }
    }

    if (dados.precoCusto && dados.precoVenda && Number(dados.precoVenda) < Number(dados.precoCusto)) {
        erros.precoVenda = 'Preço de venda não pode ser menor que o preço de custo';
    }

    if (dados.dataEntrada && dados.dataSaida) {
        if (new Date(dados.dataSaida) < new Date(dados.dataEntrada)) {
            erros.dataSaida = 'Data de saída não pode ser anterior à data de entrada';
        }
    }

    if (dados.validade) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (new Date(dados.validade) < hoje) {
            erros.validade = 'Data de validade não pode estar no passado';
        }
    }

    if (Object.keys(erros).length > 0) {
        throw new ErroValidacao('Existem campos inválidos no formulário', erros);
    }
}

async function cadastrarProduto(dados) {
    validarProduto(dados, { exigirCodigo: true });

    const existente = await produtoRepository.buscarPorCodigo(dados.codigo.trim());
    if (existente) {
        throw new ErroValidacao('Já existe um produto com esse código interno', {
            codigo: 'Código já cadastrado'
        });
    }

    const id = await produtoRepository.criar({
        codigo: dados.codigo.trim(),
        nome: dados.nome.trim(),
        marca: dados.marca?.trim(),
        categoria: dados.categoria?.trim(),
        faixaEtaria: dados.faixaEtaria?.trim(),
        tamanho: dados.tamanho?.trim(),
        quantidade: Number(dados.quantidade),
        precoCusto: dados.precoCusto ? Number(dados.precoCusto) : null,
        precoVenda: dados.precoVenda ? Number(dados.precoVenda) : null,
        dataEntrada: dados.dataEntrada || null,
        dataSaida: dados.dataSaida || null,
        validade: dados.validade || null,
        observacoes: dados.observacoes?.trim()
    });

    return produtoRepository.buscarPorId(id);
}

async function atualizarProduto(id, dados) {
    const produtoExistente = await produtoRepository.buscarPorId(id);
    if (!produtoExistente) {
        throw new ErroValidacao('Produto não encontrado', {});
    }

    validarProduto(dados, { exigirCodigo: false });

    await produtoRepository.atualizar(id, {
        nome: dados.nome.trim(),
        marca: dados.marca?.trim(),
        categoria: dados.categoria?.trim(),
        faixaEtaria: dados.faixaEtaria?.trim(),
        tamanho: dados.tamanho?.trim(),
        quantidade: Number(dados.quantidade),
        precoCusto: dados.precoCusto ? Number(dados.precoCusto) : null,
        precoVenda: dados.precoVenda ? Number(dados.precoVenda) : null,
        dataEntrada: dados.dataEntrada || null,
        dataSaida: dados.dataSaida || null,
        validade: dados.validade || null,
        observacoes: dados.observacoes?.trim()
    });

    return produtoRepository.buscarPorId(id);
}

async function listarProdutos() {
    return produtoRepository.listarTodos();
}

async function buscarProduto(id) {
    const produto = await produtoRepository.buscarPorId(id);
    if (!produto) {
        throw new ErroValidacao('Produto não encontrado', {});
    }
    return produto;
}

async function removerProduto(id) {
    const removido = await produtoRepository.remover(id);
    if (!removido) {
        throw new ErroValidacao('Produto não encontrado', {});
    }
}

module.exports = {
    ErroValidacao,
    cadastrarProduto,
    atualizarProduto,
    listarProdutos,
    buscarProduto,
    removerProduto
};