const API_URL = window.location.origin;
const USER_KEYS = ['babycareUsuario', 'babycareUser'];

const dashboardState = {
  carregando: false,
  periodo: '30d',
  dados: null,
  erro: null,
  requestId: 0,
  controlador: null,
  toastTimer: null
};

const elementos = {};

function selecionarElementos() {
  const ids = [
    'openSidebarButton',
    'topbarSearch',
    'notificationButton',
    'notificationCount',
    'periodSelect',
    'refreshButton',
    'metricProducts',
    'metricStock',
    'metricLowStock',
    'metricMovements',
    'movementPeriodLabel',
    'categoryList',
    'categoryTotal',
    'activityBody',
    'historyButton',
    'dashboardToast',
    'topbarAvatar',
    'topbarUserName',
    'topbarUserRole',
    'welcomeName',
    'currentDate'
  ];

  ids.forEach((id) => {
    elementos[id] = document.getElementById(id);
  });
}

function obterUsuarioSessao() {
  for (const chave of USER_KEYS) {
    const valores = [window.localStorage.getItem(chave), window.sessionStorage.getItem(chave)];

    for (const valor of valores) {
      if (!valor) continue;

      try {
        const usuario = JSON.parse(valor);
        if (usuario && typeof usuario === 'object') return usuario;
      } catch (erro) {
        // A interface permanece utilizável mesmo se a sessão antiga estiver corrompida.
      }
    }
  }

  return {};
}

function obterIniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/u).filter(Boolean);
  if (partes.length === 0) return 'U';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function formatarPerfil(perfil) {
  return String(perfil || 'Perfil de acesso')
    .replace(/_/gu, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\S/gu, (letra) => letra.toLocaleUpperCase('pt-BR'));
}

function inicializarUsuario() {
  const usuario = obterUsuarioSessao();
  const nome = typeof usuario.nome === 'string' && usuario.nome.trim()
    ? usuario.nome.trim()
    : 'Usuário Babycare';
  const perfil = formatarPerfil(usuario.perfil);
  const iniciais = obterIniciais(nome);

  if (elementos.topbarUserName) elementos.topbarUserName.textContent = nome;
  if (elementos.topbarUserRole) elementos.topbarUserRole.textContent = perfil;
  if (elementos.welcomeName) elementos.welcomeName.textContent = nome.split(/\s+/u)[0];
  if (elementos.topbarAvatar) elementos.topbarAvatar.textContent = iniciais;
  if (elementos.currentDate) elementos.currentDate.textContent = `Hoje é ${new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date())}.`;
}

function limparSessao() {
  [...USER_KEYS].forEach((chave) => {
    window.localStorage.removeItem(chave);
    window.sessionStorage.removeItem(chave);
  });
}

function formatarNumero(valor, casas = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  }).format(valor);
}

function formatarQuantidade(valor) {
  return formatarNumero(valor, 3).replace(/,?0+$/u, '').replace(/,$/u, '');
}

function obterNumero(objeto, chaves, nomeCampo) {
  if (!objeto || typeof objeto !== 'object') {
    throw new Error(`Campo ausente na resposta: ${nomeCampo}`);
  }

  const chave = chaves.find((item) => Object.prototype.hasOwnProperty.call(objeto, item));
  if (!chave) throw new Error(`Campo ausente na resposta: ${nomeCampo}`);

  const numero = Number(objeto[chave]);
  if (!Number.isFinite(numero) || numero < 0) {
    throw new Error(`Campo inválido na resposta: ${nomeCampo}`);
  }

  return numero;
}

function obterLista(valor) {
  return Array.isArray(valor) ? valor : [];
}

function normalizarAlertas(alertas) {
  if (alertas == null) return [];
  if (Array.isArray(alertas)) return alertas;
  if (typeof alertas !== 'object') {
    throw new Error('Os alertas da resposta possuem uma estrutura inválida.');
  }

  const lista = [];
  const estoqueBaixo = obterLista(alertas.estoqueBaixo);
  const semEstoque = obterLista(alertas.semEstoque);
  const proximosDaValidade = obterLista(alertas.produtosProximosDaValidade);
  const vencidos = obterLista(alertas.produtosVencidos);

  estoqueBaixo.forEach((produto) => {
    lista.push({
      tipo: 'warning',
      titulo: `${produto.nome || 'Produto'} está abaixo do mínimo`,
      detalhe: `${formatarNumero(produto.estoqueAtual)} disponíveis · mínimo ${formatarNumero(produto.estoqueMinimo)}`
    });
  });

  semEstoque.forEach((produto) => {
    lista.push({
      tipo: 'danger',
      titulo: `${produto.nome || 'Produto'} sem estoque`,
      detalhe: 'Produto precisa de reposição.'
    });
  });

  proximosDaValidade.forEach((lote) => {
    lista.push({
      tipo: 'attention',
      titulo: `${lote.nome || 'Produto'} próximo do vencimento`,
      detalhe: `${formatarNumero(lote.diasParaVencer)} dias restantes · lote ${lote.numeroLote || 'não informado'}`
    });
  });

  vencidos.forEach((lote) => {
    lista.push({
      tipo: 'danger',
      titulo: `${lote.nome || 'Produto'} possui lote vencido`,
      detalhe: `Lote ${lote.numeroLote || 'não informado'} · validade ${lote.dataValidade || 'não informada'}`
    });
  });

  return lista;
}

function normalizarResposta(payload) {
  const dados = payload && typeof payload.data === 'object' ? payload.data : payload;
  if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
    throw new Error('A API retornou uma estrutura inválida.');
  }

  const resumo = dados.resumo || dados.summary;

  return {
    periodo: dados.periodo || dashboardState.periodo,
    resumo: {
      totalProdutos: obterNumero(resumo, ['totalProdutos', 'produtosAtivos', 'total_produtos'], 'totalProdutos'),
      estoqueTotal: obterNumero(resumo, ['estoqueTotal', 'totalEstoque', 'estoque_total'], 'estoqueTotal'),
      estoqueBaixo: obterNumero(resumo, ['estoqueBaixo', 'produtosEstoqueBaixo', 'estoque_baixo'], 'estoqueBaixo'),
      movimentacoesPeriodo: obterNumero(resumo, ['movimentacoesPeriodo', 'totalMovimentacoes', 'movimentacoes_periodo'], 'movimentacoesPeriodo')
    },
    grafico: dados.grafico || dados.movimentacoesGrafico || dados.serieMovimentacoes || null,
    alertas: normalizarAlertas(dados.alertas),
    categorias: obterLista(dados.categorias || dados.produtosPorCategoria),
    atividadesRecentes: obterLista(dados.atividadesRecentes || dados.atividades || dados.movimentacoesRecentes)
  };
}

function atualizarIndicadores(resumo) {
  if (elementos.metricProducts) elementos.metricProducts.textContent = formatarNumero(resumo.totalProdutos);
  if (elementos.metricStock) elementos.metricStock.textContent = formatarQuantidade(resumo.estoqueTotal);
  if (elementos.metricLowStock) elementos.metricLowStock.textContent = formatarNumero(resumo.estoqueBaixo);
  if (elementos.metricMovements) elementos.metricMovements.textContent = formatarNumero(resumo.movimentacoesPeriodo);
  if (elementos.movementPeriodLabel) elementos.movementPeriodLabel.textContent = `no período selecionado (${dashboardState.periodo})`;
}

function criarEstadoVazio(titulo, detalhe) {
  const estado = document.createElement('div');
  estado.className = 'empty-state';
  const conteudo = document.createElement('div');
  const tituloElemento = document.createElement('strong');
  const detalheElemento = document.createElement('span');
  tituloElemento.textContent = titulo;
  detalheElemento.textContent = detalhe;
  conteudo.append(tituloElemento, detalheElemento);
  estado.appendChild(conteudo);
  return estado;
}

function renderizarCategorias(categorias) {
  if (elementos.categoryList) elementos.categoryList.dataset.state = 'ready';
  elementos.categoryList?.replaceChildren();

  if (categorias.length === 0) {
    if (elementos.categoryTotal) elementos.categoryTotal.textContent = '0';
    return;
  }

  const valores = categorias.map((item) => Number(item.total ?? item.quantidade ?? item.valor ?? 0));
  const maiorValor = Math.max(...valores, 1);
  const total = valores.reduce((soma, valor) => soma + (Number.isFinite(valor) && valor >= 0 ? valor : 0), 0);
  if (elementos.categoryTotal) elementos.categoryTotal.textContent = formatarNumero(total);

  categorias.slice(0, 5).forEach((categoria) => {
    const valor = Number(categoria.total ?? categoria.quantidade ?? categoria.valor ?? 0);
    if (!Number.isFinite(valor) || valor < 0) return;

    const linha = document.createElement('div');
    linha.className = 'category-row';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'category-row-header';
    const nome = document.createElement('span');
    const quantidade = document.createElement('strong');
    nome.textContent = String(categoria.nome || categoria.categoria || 'Sem categoria');
    quantidade.textContent = formatarNumero(valor);
    cabecalho.append(nome, quantidade);

    const trilho = document.createElement('div');
    trilho.className = 'category-track';
    const barra = document.createElement('div');
    barra.className = 'category-bar';
    barra.style.width = `${Math.max((valor / maiorValor) * 100, valor > 0 ? 4 : 0)}%`;
    trilho.appendChild(barra);
    linha.append(cabecalho, trilho);
    elementos.categoryList?.appendChild(linha);
  });
}

function formatarDataHora(valor) {
  if (!valor) return 'Data não informada';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data);
}

function renderizarAtividades(atividades) {
  elementos.activityBody?.replaceChildren();

  if (atividades.length === 0) {
    const linha = document.createElement('tr');
    const celula = document.createElement('td');
    celula.colSpan = 4;
    celula.className = 'table-empty';
    celula.textContent = 'Nenhuma atividade registrada neste período.';
    linha.appendChild(celula);
    elementos.activityBody?.appendChild(linha);
    return;
  }

  atividades.slice(0, 8).forEach((atividade) => {
    const linha = document.createElement('tr');
    const atividadeCelula = document.createElement('td');
    const responsavelCelula = document.createElement('td');
    const dataCelula = document.createElement('td');
    const statusCelula = document.createElement('td');
    const status = document.createElement('span');

    atividadeCelula.textContent = String(atividade.atividade || atividade.descricao || atividade.tipo || 'Movimentação');
    responsavelCelula.textContent = String(atividade.responsavel || atividade.usuario || 'Não informado');
    dataCelula.textContent = formatarDataHora(atividade.data || atividade.criadoEm || atividade.criado_em);
    const statusTexto = String(atividade.status || 'CONFIRMADA').toUpperCase();
    status.className = `activity-status${statusTexto === 'CANCELADA' ? ' cancelled' : ''}`;
    status.textContent = statusTexto;
    statusCelula.appendChild(status);
    linha.append(atividadeCelula, responsavelCelula, dataCelula, statusCelula);
    elementos.activityBody?.appendChild(linha);
  });
}

function removerErroDashboard() {
  document.getElementById('dashboardError')?.remove();
}

function mostrarErroDashboard() {
  removerErroDashboard();
  const erro = document.createElement('section');
  erro.id = 'dashboardError';
  erro.className = 'dashboard-error';
  erro.innerHTML = '<div><strong>Não foi possível carregar os dados.</strong><br><span>Tente novamente. Se o problema continuar, confira a API da Dashboard.</span></div>';
  document.querySelector('.dashboard-content').prepend(erro);
}

function mostrarToast(mensagem) {
  if (!elementos.dashboardToast) return;
  window.clearTimeout(dashboardState.toastTimer);
  elementos.dashboardToast.textContent = mensagem;
  elementos.dashboardToast.classList.add('show');
  dashboardState.toastTimer = window.setTimeout(() => {
    elementos.dashboardToast.classList.remove('show');
  }, 2800);
}

function atualizarInterface(dados) {
  atualizarIndicadores(dados.resumo);
  renderizarCategorias(dados.categorias);
  renderizarAtividades(dados.atividadesRecentes);
}

async function requisitarDashboard() {
  const url = new URL(`${API_URL}/api/dashboard`);
  url.searchParams.set('periodo', dashboardState.periodo);
  const resposta = await fetch(url, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
    credentials: 'include',
    signal: dashboardState.controlador.signal
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.status === 401 || resposta.status === 403) {
    limparSessao();
    window.location.replace('./login.html');
    return null;
  }

  if (!resposta.ok) {
    throw new Error(corpo.mensagem || `A API retornou HTTP ${resposta.status}.`);
  }

  return normalizarResposta(corpo);
}

async function carregarDashboard({ silencioso = false } = {}) {
  if (dashboardState.carregando) return;

  dashboardState.carregando = true;
  dashboardState.erro = null;
  dashboardState.requestId += 1;
  const requestAtual = dashboardState.requestId;
  dashboardState.controlador?.abort();
  dashboardState.controlador = new AbortController();
  if (elementos.refreshButton) elementos.refreshButton.disabled = true;

  if (!silencioso && !dashboardState.dados) {
    document.body.dataset.dashboardState = 'loading';
  }

  try {
    const dados = await requisitarDashboard();
    if (!dados || requestAtual !== dashboardState.requestId) return;
    dashboardState.dados = dados;
    atualizarInterface(dados);
    removerErroDashboard();
    document.body.dataset.dashboardState = 'ready';
  } catch (erro) {
    if (erro.name === 'AbortError' || requestAtual !== dashboardState.requestId) return;
    console.error('[Dashboard]', erro);
    dashboardState.erro = erro;
    document.body.dataset.dashboardState = 'error';
    mostrarErroDashboard();
    if (!silencioso) mostrarToast('Não foi possível atualizar a dashboard.');
  } finally {
    if (requestAtual === dashboardState.requestId) {
      dashboardState.carregando = false;
      dashboardState.controlador = null;
      if (elementos.refreshButton) elementos.refreshButton.disabled = false;
    }
  }
}

function configurarNavegacao() {
  if (elementos.openSidebarButton) elementos.openSidebarButton.addEventListener('click', () => document.body.classList.add('sidebar-open'));

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });

  document.querySelectorAll('[data-coming-soon]').forEach((botao) => {
    botao.addEventListener('click', () => mostrarToast(`${botao.dataset.comingSoon} será implementado nas próximas etapas.`));
  });

  elementos.notificationButton?.addEventListener('click', () => {
    document.querySelector('.alerts-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  elementos.historyButton?.addEventListener('click', () => {
    mostrarToast('O histórico completo será implementado na etapa de Movimentações.');
  });

  elementos.topbarSearch?.addEventListener('search', () => {
    if (elementos.topbarSearch.value.trim()) {
      mostrarToast('A busca geral será conectada aos módulos nas próximas etapas.');
    }
  });
}

function configurarControles() {
  elementos.periodSelect?.addEventListener('change', () => {
    dashboardState.periodo = elementos.periodSelect.value;
    carregarDashboard();
  });

  if (elementos.refreshButton) elementos.refreshButton.addEventListener('click', () => carregarDashboard());

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) carregarDashboard({ silencioso: true });
  });

  window.addEventListener('pageshow', () => carregarDashboard({ silencioso: true }));
}

function iniciarDashboard() {
  selecionarElementos();

  inicializarUsuario();
  configurarNavegacao();
  configurarControles();
  carregarDashboard();
}

document.addEventListener('DOMContentLoaded', iniciarDashboard);
