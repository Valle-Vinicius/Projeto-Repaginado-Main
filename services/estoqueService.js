const estoqueRepository = require('../repositories/estoqueRepository');

const PERFIS_ESTOQUE = ['OPERADOR_ESTOQUE', 'GERENTE', 'ADMINISTRADOR'];

function numero(valor) {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : 0;
}

function normalizarProduto(produto) {
  return {
    ...produto,
    id: Number(produto.id),
    categoriaId: produto.categoriaId === null ? null : Number(produto.categoriaId),
    estoque: numero(produto.estoque),
    estoqueMinimo: numero(produto.estoqueMinimo),
    unidade: produto.unidade || 'UN',
    possuiValidade: Boolean(produto.possuiValidade),
    status: produto.status,
    statusProduto: 'ATIVO'
  };
}

function normalizarMovimentacao(movimentacao) {
  return {
    ...movimentacao,
    id: Number(movimentacao.id),
    produtoId: Number(movimentacao.produtoId),
    quantidade: numero(movimentacao.quantidade),
    observacao: movimentacao.observacao || null
  };
}

function erroComStatus(mensagem, statusCode = 400) {
  const erro = new Error(mensagem);
  erro.statusCode = statusCode;
  return erro;
}

function validarId(valor, campo) {
  const convertido = Number(valor);
  if (!Number.isInteger(convertido) || convertido <= 0) {
    throw erroComStatus(`${campo} inválido.`);
  }
  return convertido;
}

function validarQuantidade(valor) {
  const quantidade = Number(valor);
  if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 999999999) {
    throw erroComStatus('A quantidade deve ser maior que zero.');
  }
  if (Number((quantidade * 1000).toFixed(6)) % 1 !== 0) {
    throw erroComStatus('A quantidade pode ter no máximo três casas decimais.');
  }
  return quantidade;
}

function normalizarData(valor) {
  if (!valor) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(valor))) {
    throw erroComStatus('A data de validade deve estar no formato AAAA-MM-DD.');
  }
  return String(valor);
}

function montarObservacao({ motivo, observacao }) {
  const motivoNormalizado = String(motivo || '').trim();
  const observacaoNormalizada = String(observacao || '').trim();
  const texto = [motivoNormalizado && `Motivo: ${motivoNormalizado}`, observacaoNormalizada].filter(Boolean).join(' | ');
  return texto ? texto.slice(0, 255) : null;
}

async function obterEstoque({ busca = '', categoriaId = null, status = '', ordenacao = 'nome' } = {}) {
  const categoria = categoriaId ? validarId(categoriaId, 'Categoria') : null;
  const produtos = await estoqueRepository.buscarProdutos({
    busca: String(busca || '').trim(),
    categoriaId: categoria
  });
  const [categorias, localizacoes, resumo, movimentacoes] = await Promise.all([
    estoqueRepository.buscarCategorias(),
    estoqueRepository.buscarLocalizacoes(),
    estoqueRepository.buscarResumo(),
    estoqueRepository.buscarMovimentacoes(20)
  ]);

  let produtosFiltrados = produtos.map(normalizarProduto);
  if (['NORMAL', 'BAIXO', 'SEM_ESTOQUE'].includes(status)) {
    produtosFiltrados = produtosFiltrados.filter((produto) => produto.status === status);
  }

  produtosFiltrados.sort((a, b) => {
    if (ordenacao === 'estoque-menor') return a.estoque - b.estoque || a.nome.localeCompare(b.nome, 'pt-BR');
    if (ordenacao === 'estoque-maior') return b.estoque - a.estoque || a.nome.localeCompare(b.nome, 'pt-BR');
    if (ordenacao === 'movimentacao') return new Date(b.ultimaMovimentacao || 0) - new Date(a.ultimaMovimentacao || 0);
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });

  return {
    resumo: {
      totalProdutos: Number(resumo.totalProdutos || 0),
      estoqueTotal: numero(resumo.estoqueTotal),
      estoqueBaixo: Number(resumo.estoqueBaixo || 0),
      semEstoque: Number(resumo.semEstoque || 0),
      movimentacoesHoje: Number(resumo.movimentacoesHoje || 0)
    },
    categorias: categorias.map((categoriaAtual) => ({
      id: Number(categoriaAtual.id),
      nome: categoriaAtual.nome
    })),
    localizacoes: localizacoes.map((localizacao) => ({
      id: Number(localizacao.id),
      nome: localizacao.nome,
      descricao: localizacao.descricao || null
    })),
    produtos: produtosFiltrados,
    movimentacoes: movimentacoes.map(normalizarMovimentacao)
  };
}

async function obterRecebimentos({ busca = '', limite = 100 } = {}) {
  const recebimentos = await estoqueRepository.buscarRecebimentos({ busca, limite });
  return recebimentos.map((item) => ({
    ...item,
    id: Number(item.id),
    produtoId: Number(item.produtoId),
    quantidade: numero(item.quantidade),
    saldoLote: numero(item.saldoLote),
    dataValidade: item.dataValidade || null,
    fornecedor: item.fornecedor || null,
    documento: item.documento || null,
    localizacao: item.localizacao || null,
    responsavel: item.responsavel || 'Sistema'
  }));
}

async function obterExpedicoes({ busca = '', limite = 100 } = {}) {
  const expedicoes = await estoqueRepository.buscarExpedicoes({ busca, limite });
  return expedicoes.map((item) => ({
    ...item,
    id: Number(item.id),
    produtoId: Number(item.produtoId),
    quantidade: numero(item.quantidade),
    responsavel: item.responsavel || 'Sistema',
    destinatario: item.destinatario || null,
    destino: item.destino || null,
    documento: item.documento || null
  }));
}

async function registrarMovimentacao({
  usuarioId,
  tipo,
  produtoId,
  quantidade,
  loteId,
  numeroLote,
  dataValidade,
  localizacaoId,
  fornecedor,
  documento,
  destinatario,
  destino,
  motivo,
  observacao
}) {
  if (!['ENTRADA', 'SAIDA'].includes(tipo)) {
    throw erroComStatus('Tipo de movimentação inválido.');
  }

  const produto = validarId(produtoId, 'Produto');
  const quantidadeValidada = validarQuantidade(quantidade);
  const usuario = usuarioId ? validarId(usuarioId, 'Usuário') : null;
  const observacaoFinal = montarObservacao({ motivo, observacao });

  if (tipo === 'ENTRADA') {
    const loteInformado = loteId ? validarId(loteId, 'Lote') : null;
    const localizacao = localizacaoId ? validarId(localizacaoId, 'Localização') : null;
    return estoqueRepository.registrarEntrada({
      produtoId: produto,
      usuarioId: usuario,
      quantidade: quantidadeValidada,
      loteId: loteInformado,
      numeroLote,
      dataValidade: normalizarData(dataValidade),
      localizacaoId: localizacao,
      fornecedor,
      documento,
      observacao: observacaoFinal
    });
  }

  const loteInformado = loteId ? validarId(loteId, 'Lote') : null;
  return estoqueRepository.registrarSaida({
    produtoId: produto,
      usuarioId: usuario,
      quantidade: quantidadeValidada,
      loteId: loteInformado,
      destinatario,
      destino,
      documento,
      observacao: observacaoFinal
    });
}

module.exports = {
  obterEstoque,
  obterRecebimentos,
  obterExpedicoes,
  registrarMovimentacao,
  PERFIS_ESTOQUE
};
