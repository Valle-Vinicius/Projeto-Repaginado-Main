import { API_URL } from '../../js/core/api.js';
import {
  salvarFiltros as salvarFiltrosCore,
  carregarFiltros as carregarFiltrosCore,
} from '../../js/core/index.js';
import {
  mostrarCarregamento,
  esconderCarregamento,
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
  const r = await fetch(`${RELATORIOS_API_URL}?${params}`, {
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
  const serie = Array.isArray(dados.serie) ? dados.serie : [];
  if (serie.length === 0) {
    el.chart.hidden = true;
    el.labels.replaceChildren();
    el.labels.hidden = true;
    el.chartEmpty.textContent = 'Não existem movimentações no período selecionado.';
    el.chartEmpty.hidden = false;
    return;
  }
  el.chart.hidden = false;
  el.labels.hidden = false;
  el.chartEmpty.hidden = true;

  const labels = serie.map((s) => dataCurta(s.label || s.periodo || s.data || ''));
  const entradas = serie.map((s) => Number(s.entradas || s.entrada || 0));
  const saidas = serie.map((s) => Number(s.saidas || s.saida || 0));

  const maxValor = Math.max(...entradas, ...saidas, 1);

  el.labels.replaceChildren();
  labels.forEach((label, i) => {
    const div = document.createElement('div');
    div.className = 'report-label';
    div.textContent = label;
    el.labels.appendChild(div);
  });

  const entradasPath = entradas
    .map((v, i) => {
      const x = (i / (entradas.length - 1 || 1)) * 720;
      const y = 220 - (v / maxValor) * 180;
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
  el.entryLine.setAttribute('d', entradasPath);

  const entradasArea = `M0 220 ${entradasPath} L720 220 Z`;
  el.entryArea.setAttribute('d', entradasArea);

  const saidasPath = saidas
    .map((v, i) => {
      const x = (i / (saidas.length - 1 || 1)) * 720;
      const y = 220 - (v / maxValor) * 180;
      return `${i === 0 ? 'M' : 'L'}${x} ${y}`;
    })
    .join(' ');
  el.exitLine.setAttribute('d', saidasPath);

  const saidasArea = `M0 220 ${saidasPath} L720 220 Z`;
  el.exitArea.setAttribute('d', saidasArea);
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
    tr.innerHTML = `<td>${dataCurta(item.criadoEm)}</td><td>${esc(item.produto)}</td><td><span class="report-type ${tipoClasse}">${esc(tipoTexto)}</span></td><td>${num(item.quantidade)}</td><td>${esc(item.responsavel)}</td>`;
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

  mostrarCarregamento('Gerando relatório...');
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
  } catch (x) {
    if ([401, 403].includes(x.status)) {
      location.href = './login.html';
      return;
    }
    renderFalha(x.message || 'Não foi possível gerar o relatório.');
    mostrarToast(x.message, 'error');
  } finally {
    esconderCarregamento();
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

window.addEventListener('load', () => {
  configurar();
  carregar();
});
