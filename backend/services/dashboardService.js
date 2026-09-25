const dashboardRepository = require('../repositories/dashboardRepository');

const PERIODOS_PERMITIDOS = Object.freeze(['hoje', '7d', '30d', 'mes']);
const LIMITE_ALERTAS = 10;
const LIMITE_ATIVIDADES = 8;

function erroDadoInvalido(mensagem) {
  const erro = new Error(mensagem);
  erro.code = 'DASHBOARD_DADO_INVALIDO';
  erro.statusCode = 500;
  return erro;
}

function numeroNaoNegativo(valor, campo) {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero) || numero < 0) {
    throw erroDadoInvalido(`O campo ${campo} retornou um valor inválido.`);
  }
  return numero;
}

function numeroFinito(valor, campo) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw erroDadoInvalido(`O campo ${campo} retornou um valor inválido.`);
  }
  return numero;
}

function inteiroPositivo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1) {
    throw erroDadoInvalido(`O campo ${campo} retornou um identificador inválido.`);
  }
  return numero;
}

function listaOuVazia(valor) {
  if (valor == null) return [];
  if (!Array.isArray(valor)) {
    throw erroDadoInvalido('Uma lista da Dashboard retornou uma estrutura inválida.');
  }
  return valor;
}

function validarPeriodo(periodo) {
  if (!PERIODOS_PERMITIDOS.includes(periodo)) {
    const erro = new Error(`Período inválido. Use: ${PERIODOS_PERMITIDOS.join(', ')}.`);
    erro.code = 'PERIODO_INVALIDO';
    erro.statusCode = 400;
    throw erro;
  }
}

function normalizarResumo(resumo, resumoMovimentacoes) {
  const totalProdutos = numeroNaoNegativo(resumo.totalProdutos, 'totalProdutos');
  const produtosAtivos = numeroNaoNegativo(resumo.produtosAtivos, 'produtosAtivos');
  const estoqueTotal = numeroNaoNegativo(resumo.estoqueTotal, 'estoqueTotal');
  const estoqueBaixo = numeroNaoNegativo(resumo.estoqueBaixo, 'estoqueBaixo');
  const semEstoque = numeroNaoNegativo(resumo.semEstoque, 'semEstoque');
  const movimentacoesPeriodo = numeroNaoNegativo(
    resumoMovimentacoes.movimentacoesPeriodo,
    'movimentacoesPeriodo'
  );
  const entradasPeriodo = numeroNaoNegativo(
    resumoMovimentacoes.entradasPeriodo,
    'entradasPeriodo'
  );
  const saidasPeriodo = numeroNaoNegativo(
    resumoMovimentacoes.saidasPeriodo,
    'saidasPeriodo'
  );

  if (produtosAtivos > totalProdutos || estoqueBaixo > totalProdutos || semEstoque > totalProdutos) {
    throw erroDadoInvalido('Os indicadores de produtos da Dashboard são inconsistentes.');
  }

  if (estoqueBaixo + semEstoque > totalProdutos) {
    throw erroDadoInvalido('As categorias de estoque da Dashboard são inconsistentes.');
  }

  return {
    totalProdutos,
    produtosAtivos,
    estoqueTotal,
    estoqueBaixo,
    semEstoque,
    movimentacoesPeriodo,
    entradasPeriodo,
    saidasPeriodo
  };
}

function normalizarProdutoAlerta(produto) {
  return {
    id: inteiroPositivo(produto.id, 'alerta.id'),
    codigo: String(produto.codigo || ''),
    nome: String(produto.nome || 'Produto sem nome'),
    estoqueMinimo: numeroNaoNegativo(produto.estoqueMinimo, 'estoqueMinimo'),
    estoqueAtual: numeroNaoNegativo(produto.estoqueAtual, 'estoqueAtual'),
    status: String(produto.status || '')
  };
}

function normalizarValidade(lote) {
  return {
    loteId: inteiroPositivo(lote.loteId, 'validade.loteId'),
    produtoId: inteiroPositivo(lote.produtoId, 'validade.produtoId'),
    codigo: String(lote.codigo || ''),
    nome: String(lote.nome || 'Produto sem nome'),
    numeroLote: String(lote.numeroLote || ''),
    quantidadeAtual: numeroNaoNegativo(lote.quantidadeAtual, 'quantidadeAtual'),
    dataValidade: lote.dataValidade,
    diasParaVencer: numeroFinito(lote.diasParaVencer, 'diasParaVencer'),
    status: String(lote.status || '')
  };
}

function normalizarGrafico(movimentacoes) {
  return listaOuVazia(movimentacoes).map((movimentacao) => ({
    data: String(movimentacao.data),
    entradas: numeroNaoNegativo(movimentacao.entradas, 'grafico.entradas'),
    saidas: numeroNaoNegativo(movimentacao.saidas, 'grafico.saidas')
  }));
}

function normalizarCategorias(categorias) {
  return listaOuVazia(categorias).map((categoria) => ({
    nome: String(categoria.nome || 'Sem categoria'),
    total: numeroNaoNegativo(categoria.total, 'categorias.total')
  }));
}

function normalizarAtividade(atividade) {
  const tipo = String(atividade.tipo || 'MOVIMENTACAO');
  const produto = String(atividade.produto || 'Produto não informado');
  const quantidade = numeroNaoNegativo(atividade.quantidade, 'atividades.quantidade');
  const status = String(atividade.status || 'CONFIRMADA');

  return {
    id: inteiroPositivo(atividade.id, 'atividade.id'),
    tipo,
    atividade: `${tipo === 'SAIDA' ? 'Saída' : tipo === 'ENTRADA' ? 'Entrada' : 'Ajuste'} · ${produto}`,
    produto,
    produtoId: inteiroPositivo(atividade.produtoId, 'atividade.produtoId'),
    quantidade,
    observacao: atividade.observacao ? String(atividade.observacao) : null,
    usuario: String(atividade.usuario || 'Usuário removido'),
    usuarioId: atividade.usuarioId == null ? null : inteiroPositivo(atividade.usuarioId, 'atividade.usuarioId'),
    criadoEm: atividade.criadoEm,
    status
  };
}

async function obterDashboard({ periodo = '30d' } = {}) {
  validarPeriodo(periodo);

  const [
    resumo,
    resumoMovimentacoes,
    estoqueBaixo,
    semEstoque,
    validadesProximas,
    vencidos,
    movimentacoes,
    categorias,
    atividadesRecentes
  ] = await Promise.all([
    dashboardRepository.buscarResumo(),
    dashboardRepository.buscarResumoMovimentacoes(periodo),
    dashboardRepository.buscarEstoqueBaixo(),
    dashboardRepository.buscarSemEstoque(),
    dashboardRepository.buscarValidadesProximas(30),
    dashboardRepository.buscarVencidos(),
    dashboardRepository.buscarMovimentacoes(periodo),
    dashboardRepository.buscarCategorias(5),
    dashboardRepository.buscarAtividadesRecentes(LIMITE_ATIVIDADES)
  ]);

  return {
    periodo,
    resumo: normalizarResumo(resumo || {}, resumoMovimentacoes || {}),
    grafico: normalizarGrafico(movimentacoes),
    alertas: {
      estoqueBaixo: listaOuVazia(estoqueBaixo).slice(0, LIMITE_ALERTAS).map(normalizarProdutoAlerta),
      semEstoque: listaOuVazia(semEstoque).slice(0, LIMITE_ALERTAS).map(normalizarProdutoAlerta),
      produtosProximosDaValidade: listaOuVazia(validadesProximas).slice(0, LIMITE_ALERTAS).map(normalizarValidade),
      produtosVencidos: listaOuVazia(vencidos).slice(0, LIMITE_ALERTAS).map(normalizarValidade)
    },
    categorias: normalizarCategorias(categorias),
    atividadesRecentes: listaOuVazia(atividadesRecentes).slice(0, LIMITE_ATIVIDADES).map(normalizarAtividade)
  };
}

module.exports = {
  obterDashboard,
  PERIODOS_PERMITIDOS
};
