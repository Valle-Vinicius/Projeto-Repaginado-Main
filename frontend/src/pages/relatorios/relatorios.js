import { API_URL, fetchAPI } from '../../js/core/api.js';
import {
  salvarFiltros as salvarFiltrosCore,
  carregarFiltros as carregarFiltrosCore,
} from '../../js/core/index.js';
import {
  formatarNumero,
  formatarData,
  mostrarToast,
  conectarBuscaTopbar,
  exportarCSV,
} from '../../js/core/ui.js';

const RELATORIOS_API_URL = `${API_URL}/relatorios`;

const el = {
  period: document.querySelector('#reportPeriod'),
  type: document.querySelector('#reportType'),
  category: document.querySelector('#reportCategory'),
  product: document.querySelector('#reportProduct'),
  refresh: document.querySelector('#refreshReportButton'),
  exportCsv: document.querySelector('#exportReportButton'),
  movements: document.querySelector('#reportMovements'),
  entries: document.querySelector('#reportEntries'),
  exits: document.querySelector('#reportExits'),
  products: document.querySelector('#reportProducts'),
  chart: document.querySelector('#reportChart'),
  entryArea: document.querySelector('#reportEntryArea'),
  exitArea: document.querySelector('#reportExitArea'),
  entryLine: document.querySelector('#reportEntryLine'),
  exitLine: document.querySelector('#reportExitLine'),
  entryPoints: document.querySelector('#reportEntryPoints'),
  exitPoints: document.querySelector('#reportExitPoints'),
  labels: document.querySelector('#reportChartLabels'),
  chartEmpty: document.querySelector('#reportChartEmpty'),
  categoryList: document.querySelector('#reportCategoryList'),
  categoryEmpty: document.querySelector('#reportCategoryEmpty'),
  productList: document.querySelector('#reportProductList'),
  productEmpty: document.querySelector('#reportProductEmpty'),
  historyBody: document.querySelector('#reportHistoryBody'),
  historyCount: document.querySelector('#reportHistoryCount'),
  historyEmpty: document.querySelector('#reportHistoryEmpty'),
  error: document.querySelector('#reportError'),
  side: document.querySelector('#sidebarSearch'),
  open: document.querySelector('#openSidebarButton'),
  close: document.querySelector('#closeSidebarButton'),
  logout: document.querySelector('#logoutButton'),
};
let dados = null;
let filtrosRestaurados = false;
let filtrosPersistidos = null;

function esc(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}

function num(v) {
  return formatarNumero(Number(v || 0), 3)
    .replace(/,?0+$/, '')
    .replace(/,$/, '');
}

function dataCurta(v) {
  if (!v) {
    return '—';
  }
  const texto = String(v);
  const d = new Date(texto.includes('T') ? texto : `${texto}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? texto.slice(0, 10)
    : new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      }).format(d);
}

async function api() {
  const params = new URLSearchParams({
    periodo: el.period.value,
    tipo: el.type.value,
    categoriaId: el.category.value,
    produtoId: el.product.value,
  });
  const r = await fetchAPI(`${RELATORIOS_API_URL}?${params}`, {
    credentials: 'include',
    cache: 'no-store',
  });
  const b = await r.json().catch(() => null);
  if (!r.ok) {
    const x = new Error(
      b?.mensagem || `Não foi possível gerar o relatório (HTTP ${r.status}).`
    );
    x.status = r.status;
    throw x;
  }
  if (!b?.dados || typeof b.dados !== 'object') {
    throw new Error('A resposta da API não contém os dados do relatório.');
  }
  return b.dados;
}

function preencherFiltros() {
  const categoriaSelecionada = el.category.value;
  const produtoSelecionado = el.product.value;
  el.category.replaceChildren(new Option('Todas as categorias', ''));
  const categorias = dados.categorias || [];
  categorias.forEach((c) => {
    el.category.appendChild(new Option(c.nome || c.descricao || c.categoria, c.id));
  });

  el.product.replaceChildren(new Option('Todos os produtos', ''));
  const produtos = dados.produtos || [];
  produtos.forEach((p) => {
    el.product.appendChild(new Option(p.nome, p.id));
  });
  if (categorias.some((categoria) => String(categoria.id) === categoriaSelecionada)) {
    el.category.value = categoriaSelecionada;
  }
  if (produtos.some((produto) => String(produto.id) === produtoSelecionado)) {
    el.product.value = produtoSelecionado;
  }
}

function render() {
  const r = dados.resumo || {};
  el.movements.textContent = formatarNumero(r.movimentacoes || 0);
  el.entries.textContent = num(r.entradas);
  el.exits.textContent = num(r.saidas);
  el.products.textContent = formatarNumero(r.produtosMovimentados || 0);
  renderChart();
  renderCategories();
  renderProducts();
  renderHistory();
}

function renderChart() {
  const serie = montarSerieGrafico(
    Array.isArray(dados.serie) ? dados.serie : [],
  );
  el.chart.hidden = false;
  el.labels.hidden = false;
  const possuiMovimentacoes = serie.some(
    (item) => item.entradas > 0 || item.saidas > 0,
  );
  el.chartEmpty.textContent =
    'Não existem movimentações no período selecionado.';
  el.chartEmpty.hidden = possuiMovimentacoes;

  const entradas = serie.map((item) => item.entradas);
  const saidas = serie.map((item) => item.saidas);

  const maxValor = Math.max(...entradas, ...saidas, 1);
  const posicaoX = (indice) =>
    serie.length === 1 ? 360 : (indice / (serie.length - 1)) * 720;
  const posicaoY = (valor) => 220 - (valor / maxValor) * 180;

  el.labels.replaceChildren();
  const indicesRotulos = selecionarIndicesRotulos(serie.length);
  indicesRotulos.forEach((indice) => {
    const div = document.createElement('div');
    div.className = 'report-label';
    div.textContent = dataCurta(serie[indice].data);
    el.labels.appendChild(div);
  });
  el.labels.style.justifyContent =
    indicesRotulos.length === 1 ? 'center' : 'space-between';

  const criarLinha = (valores) =>
    valores
      .map(
        (valor, indice) =>
          `${indice === 0 ? 'M' : 'L'}${posicaoX(indice)} ${posicaoY(valor)}`,
      )
      .join(' ');
  const entradasPath = criarLinha(entradas);
  el.entryLine.setAttribute('d', entradasPath);
  el.entryArea.setAttribute(
    'd',
    serie.length > 1
      ? `M0 220 ${entradasPath} L720 220 Z`
      : 'M0 220 L720 220 Z',
  );

  const saidasPath = criarLinha(saidas);
  el.exitLine.setAttribute('d', saidasPath);
  el.exitArea.setAttribute(
    'd',
    serie.length > 1 ? `M0 220 ${saidasPath} L720 220 Z` : 'M0 220 L720 220 Z',
  );
  renderPontosUnicos(el.entryPoints, entradas, posicaoX, posicaoY);
  renderPontosUnicos(el.exitPoints, saidas, posicaoX, posicaoY);
}

function montarSerieGrafico(serie) {
  const porData = new Map();
  serie.forEach((item) => {
    const data = String(item.data || item.label || item.periodo || '').slice(
      0,
      10,
    );
    if (!/^\d{4}-\d{2}-\d{2}$/u.test(data)) {
      return;
    }
    const valores = porData.get(data) || { data, entradas: 0, saidas: 0 };
    valores.entradas += Number(item.entradas || item.entrada || 0);
    valores.saidas += Number(item.saidas || item.saida || 0);
    porData.set(data, valores);
  });

  const datas = new Set(diasDoPeriodo());
  porData.forEach((_, data) => datas.add(data));
  return [...datas]
    .sort()
    .map((data) => porData.get(data) || { data, entradas: 0, saidas: 0 });
}

function diasDoPeriodo() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const inicio = new Date(hoje);
  if (el.period.value === '7d') {
    inicio.setDate(inicio.getDate() - 6);
  } else if (el.period.value === '30d') {
    inicio.setDate(inicio.getDate() - 29);
  } else if (el.period.value === 'mes') {
    inicio.setDate(1);
  }

  const datas = [];
  for (
    const data = new Date(inicio);
    data <= hoje;
    data.setDate(data.getDate() + 1)
  ) {
    datas.push(
      `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
        data.getDate(),
      ).padStart(2, '0')}`,
    );
  }
  return datas;
}

function selecionarIndicesRotulos(quantidade) {
  if (quantidade <= 5) {
    return Array.from({ length: quantidade }, (_, indice) => indice);
  }
  return [
    ...new Set(
      [0, 0.25, 0.5, 0.75, 1].map((fracao) =>
        Math.round((quantidade - 1) * fracao),
      ),
    ),
  ];
}

function renderPontosUnicos(container, valores, posicaoX, posicaoY) {
  container.replaceChildren();
  if (valores.length !== 1) {
    return;
  }
  const ponto = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'circle',
  );
  ponto.setAttribute('cx', String(posicaoX(0)));
  ponto.setAttribute('cy', String(posicaoY(valores[0])));
  ponto.setAttribute('r', '4');
  ponto.setAttribute('class', 'report-point');
  container.appendChild(ponto);
}

function renderCategories() {
  const categorias = Array.isArray(dados.porCategoria) ? dados.porCategoria : [];
  el.categoryList.replaceChildren();
  if (categorias.length === 0) {
    el.categoryEmpty.hidden = false;
    return;
  }
  el.categoryEmpty.hidden = true;
  const maiorQuantidade = Math.max(...categorias.map((categoria) => Number(categoria.quantidade || 0)), 1);
  categorias.forEach((c) => {
    const item = document.createElement('div');
    item.className = 'report-category-row';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'report-category-head';
    const nome = document.createElement('span');
    nome.textContent = c.nome || c.descricao || c.categoria || 'Sem categoria';
    const quantidade = Number(c.quantidade || 0);
    const total = document.createElement('strong');
    total.textContent = formatarNumero(quantidade);
    const barra = document.createElement('div');
    barra.className = 'report-track';
    barra.setAttribute('aria-hidden', 'true');
    const preenchimento = document.createElement('i');
    preenchimento.style.width = `${Math.min(100, (quantidade / maiorQuantidade) * 100)}%`;
    barra.appendChild(preenchimento);
    cabecalho.append(nome, total);
    item.append(cabecalho, barra);
    el.categoryList.appendChild(item);
  });
}

function renderProducts() {
  const produtos = Array.isArray(dados.porProduto) ? dados.porProduto : [];
  el.productList.replaceChildren();
  if (produtos.length === 0) {
    el.productEmpty.hidden = false;
    return;
  }
  el.productEmpty.hidden = true;
  const maiorQuantidade = Math.max(...produtos.map((produto) => Number(produto.quantidade || 0)), 1);
  produtos.forEach((p) => {
    const item = document.createElement('div');
    item.className = 'report-product-row';
    const cabecalho = document.createElement('div');
    cabecalho.className = 'report-product-head';
    const identificacao = document.createElement('span');
    const nome = document.createElement('strong');
    nome.textContent = p.produto || p.nome || 'Produto sem nome';
    const codigo = document.createElement('small');
    codigo.textContent = p.codigo || 'Sem código';
    identificacao.append(nome, codigo);
    const quantidade = Number(p.quantidade || 0);
    const total = document.createElement('strong');
    total.textContent = formatarNumero(quantidade);
    const barra = document.createElement('div');
    barra.className = 'report-track';
    barra.setAttribute('aria-hidden', 'true');
    const preenchimento = document.createElement('i');
    preenchimento.style.width = `${Math.min(100, (quantidade / maiorQuantidade) * 100)}%`;
    barra.appendChild(preenchimento);
    cabecalho.append(identificacao, total);
    item.append(cabecalho, barra);
    el.productList.appendChild(item);
  });
}

function renderHistory() {
  const historico = dados.historico || [];
  el.historyBody.replaceChildren();
  el.historyCount.textContent = `${historico.length} registro${historico.length === 1 ? '' : 's'}`;
  el.historyEmpty.hidden = historico.length > 0;
  historico.forEach((item) => {
    const tr = document.createElement('tr');
    const tipo = String(item.tipo || '').toUpperCase();
    const tipoClasse = tipo === 'ENTRADA' ? 'entrada' : tipo === 'SAIDA' ? 'saida' : '';
    const tipoTexto = tipo === 'ENTRADA' ? 'Entrada' : tipo === 'SAIDA' ? 'Saída' : tipo || '—';
    tr.innerHTML = `<td>${formatarData(item.criadoEm)}</td><td>${esc(item.produto)}</td><td><span class="report-type ${tipoClasse}">${esc(tipoTexto)}</span></td><td>${num(item.quantidade)}</td><td>${esc(item.responsavel)}</td>`;
    el.historyBody.appendChild(tr);
  });
}

function renderFalha(mensagem) {
  el.movements.textContent = '—';
  el.entries.textContent = '—';
  el.exits.textContent = '—';
  el.products.textContent = '—';
  el.chart.hidden = true;
  el.labels.replaceChildren();
  el.labels.hidden = true;
  el.entryPoints.replaceChildren();
  el.exitPoints.replaceChildren();
  el.chartEmpty.textContent = 'O gráfico ficará disponível quando o relatório carregar.';
  el.chartEmpty.hidden = false;
  el.categoryList.replaceChildren();
  el.categoryEmpty.hidden = false;
  el.categoryEmpty.textContent = 'A distribuição por categoria ficará disponível após a conexão.';
  el.productList.replaceChildren();
  el.productEmpty.hidden = false;
  el.productEmpty.textContent = 'O ranking de produtos ficará disponível após a conexão.';
  el.historyBody.replaceChildren();
  el.historyCount.textContent = '—';
  el.historyEmpty.hidden = false;
  el.historyEmpty.textContent = 'O histórico ficará disponível após a conexão.';
  el.error.textContent = `${mensagem} Os dados aparecerão quando a API estiver disponível.`;
  el.error.hidden = false;
}

async function carregar() {
  window.BabycareCore.tornarBreadcrumbClicavel();
  window.BabycareCore.adicionarBotaoVoltar('.relatorios-header', 'Voltar ao dashboard');
  if (!filtrosRestaurados) {
    filtrosPersistidos = carregarFiltrosCore('relatorios');
    if (filtrosPersistidos.periodo !== undefined) el.period.value = filtrosPersistidos.periodo;
    if (filtrosPersistidos.tipo !== undefined) el.type.value = filtrosPersistidos.tipo;
  }

  document.body.dataset.reportState = 'loading';
  el.error.hidden = true;
  try {
    dados = await api();
    preencherFiltros();
    if (!filtrosRestaurados) {
      if (filtrosPersistidos.categoriaId !== undefined) {
        el.category.value = String(filtrosPersistidos.categoriaId);
      }
      if (filtrosPersistidos.produtoId !== undefined) {
        el.product.value = String(filtrosPersistidos.produtoId);
      }
      filtrosRestaurados = true;
      if (el.category.value || el.product.value) {
        dados = await api();
        preencherFiltros();
      }
    }
    render();
    document.body.dataset.reportState = 'ready';
  } catch (x) {
    if (x.status === 403) {
      document.body.dataset.reportState = 'error';
      location.href = './login.html';
      return;
    }
    renderFalha(x.message || 'Não foi possível gerar o relatório.');
    document.body.dataset.reportState = 'error';
    mostrarToast(x.message, 'error');
  }
}

function atualizarUsuario() {
  const raw =
    localStorage.getItem('babycareUsuario') ||
    sessionStorage.getItem('babycareUsuario') ||
    localStorage.getItem('babycareUser') ||
    sessionStorage.getItem('babycareUser');
  let u = {};
  try {
    u = raw ? JSON.parse(raw) : {};
  } catch (e) {}
  const nome = u.nome?.trim() || 'Usuário Babycare';
  const perfil = String(u.perfil || 'Perfil de acesso')
    .replace(/_/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\S/g, (x) => x.toLocaleUpperCase('pt-BR'));
  const parts = nome.split(/\s+/).filter(Boolean);
  const ini = (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : nome.slice(0, 2)).toUpperCase();
  ['sidebarUserName', 'topbarUserName'].forEach((id) => {
    const x = document.getElementById(id);
    if (x) {
      x.textContent = nome;
    }
  });
  ['sidebarUserRole', 'topbarUserRole'].forEach((id) => {
    const x = document.getElementById(id);
    if (x) {
      x.textContent = perfil;
    }
  });
  ['sidebarAvatar', 'topbarAvatar'].forEach((id) => {
    const x = document.getElementById(id);
    if (x) {
      x.textContent = ini;
    }
  });
}

function configurar() {
  atualizarUsuario();
  [el.period, el.type, el.category, el.product].forEach((x) =>
    x.addEventListener('change', () => {
      salvarFiltrosCore('relatorios', {
        periodo: el.period.value,
        tipo: el.type.value,
        categoriaId: el.category.value,
        produtoId: el.product.value,
      });
      carregar();
    })
  );
  el.refresh.addEventListener('click', carregar);
  el.exportCsv?.addEventListener('click', () => {
    if (!dados?.historico?.length) {
      mostrarToast('Nenhum dado para exportar.');
      return;
    }
    exportarCSV(
      dados.historico,
      [
        { key: 'criadoEm', label: 'Data' },
        { key: 'produto', label: 'Produto' },
        { key: 'codigo', label: 'Código' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'quantidade', label: 'Quantidade' },
        { key: 'responsavel', label: 'Responsável' },
      ],
      'relatorio-movimentacoes.csv'
    );
  });
  el.open?.addEventListener('click', () => document.body.classList.add('sidebar-open'));
  el.close?.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  document.querySelectorAll('.nav-link').forEach((x) => {
    x.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });
  el.side?.addEventListener('input', () => {
    const t = String(el.side?.value || '').toLocaleLowerCase('pt-BR');
    document.querySelectorAll('.main-nav .nav-link').forEach((x) => {
      x.hidden = Boolean(t) && !x.textContent.toLocaleLowerCase('pt-BR').includes(t);
    });
  });
  el.logout?.addEventListener('click', () => {
    localStorage.removeItem('babycareUsuario');
    sessionStorage.removeItem('babycareUsuario');
    location.href = './login.html';
  });
  window.BabycareCore.configurarAtalhos({
    onBuscaGlobal: () => {
      el.period?.focus();
    },
  });
  window.BabycareCore.adicionarContadorCaracteres();
  conectarBuscaTopbar(el.period);
}

configurar();
carregar();
