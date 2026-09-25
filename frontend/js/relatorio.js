const API_URL = `${window.BabycareUI.API_URL}/api/relatorios`;

const el = {
  period: document.querySelector('#reportPeriod'),
  type: document.querySelector('#reportType'),
  category: document.querySelector('#reportCategory'),
  product: document.querySelector('#reportProduct'),
  refresh: document.querySelector('#refreshReportButton'),
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
  bell: document.querySelector('#notificationButton')
};

let dados = null;

function token() {
  return localStorage.getItem('babycareToken') || sessionStorage.getItem('babycareToken');
}

function esc(v) {
  const d = document.createElement('div');
  d.textContent = v ?? '';
  return d.innerHTML;
}

function num(v) {
  return window.BabycareUI.formatarNumero(Number(v || 0), 3).replace(/,?0+$/, '').replace(/,$/, '');
}

function dataCurta(v) {
  if (!v) return '—';
  const texto = String(v);
  const d = new Date(texto.includes('T') ? texto : `${texto}T00:00:00`);
  return Number.isNaN(d.getTime()) ? texto.slice(0, 10) : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
}

async function api() {
  const params = new URLSearchParams({
    periodo: el.period.value,
    tipo: el.type.value,
    categoriaId: el.category.value,
    produtoId: el.product.value
  });
  
  const r = await fetch(`${API_URL}?${params}&_atualizacao=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${token()}`,
      'Cache-Control': 'no-cache'
    }
  });

  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    const x = new Error(b.mensagem || 'Não foi possível gerar o relatório.');
    x.status = r.status;
    throw x;
  }
  return b.dados || b;
}

function preencherFiltros() {
  const catAtual = el.category.value;
  const prodAtual = el.product.value;
  
  el.category.innerHTML = '<option value="">Todas as categorias</option>';
  el.product.innerHTML = '<option value="">Todos os produtos</option>';
  
  dados.categorias.forEach((x) => el.category.appendChild(new Option(x.nome, x.id)));
  dados.produtos.forEach((x) => el.product.appendChild(new Option(`${x.nome} — ${x.codigo}`, x.id)));
  
  el.category.value = catAtual;
  el.product.value = prodAtual;
}

function pontos(valores, max) {
  const w = 720, h = 200;
  return valores.map((v, i) => ({
    x: valores.length === 1 ? w / 2 : (i / (valores.length - 1)) * w,
    y: h - (Number(v) / max) * (h - 25) + 10
  }));
}

function path(ps) {
  return ps.length
    ? ps.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : 'M0 200 L720 200';
}

function area(ps) {
  return ps.length
    ? `${path(ps)} L${ps[ps.length - 1].x.toFixed(1)} 200 L${ps[0].x.toFixed(1)} 200 Z`
    : 'M0 200 L720 200 Z';
}

function renderChart() {
  const serie = dados.serie || [];
  const entradas = serie.map(x => Number(x.entradas || 0));
  const saidas = serie.map(x => Number(x.saidas || 0));
  const max = Math.max(...entradas, ...saidas, 1);
  const p1 = pontos(entradas, max);
  const p2 = pontos(saidas, max);
  
  el.entryLine.setAttribute('d', path(p1));
  el.exitLine.setAttribute('d', path(p2));
  el.entryArea.setAttribute('d', area(p1));
  el.exitArea.setAttribute('d', area(p2));
  
  el.labels.replaceChildren();
  serie.forEach((x) => {
    const s = document.createElement('span');
    s.textContent = dataCurta(x.data);
    el.labels.appendChild(s);
  });
  

  el.chartEmpty.hidden = serie.some(x => Number(x.entradas || 0) > 0 || Number(x.saidas || 0) > 0);
}

function renderCategories() {
  const list = dados.porCategoria || [];
  el.categoryList.replaceChildren();
  el.categoryEmpty.hidden = list.length > 0;
  const max = Math.max(...list.map(x => Number(x.quantidade || 0)), 1);
  
  list.forEach((x) => {
    const row = document.createElement('div');
    row.className = 'report-category-row';
    row.innerHTML = `<div class="report-category-head"><span>${esc(x.nome)}</span><strong>${esc(num(x.quantidade))}</strong></div><div class="report-track"><i style="width:${Math.max((Number(x.quantidade || 0) / max) * 100, Number(x.quantidade || 0) > 0 ? 4 : 0)}%"></i></div>`;
    el.categoryList.appendChild(row);
  });
}

function renderProducts() {
  const list = dados.porProduto || [];
  el.productList.replaceChildren();
  el.productEmpty.hidden = list.length > 0;
  const max = Math.max(...list.map(x => Number(x.quantidade || 0)), 1);
  
  list.forEach((x) => {
    const row = document.createElement('div');
    row.className = 'report-product-row';
    row.innerHTML = `<div class="report-product-head"><span><strong>${esc(x.produto)}</strong><small>${esc(x.codigo)}</small></span><strong>${esc(num(x.quantidade))}</strong></div><div class="report-track"><i style="width:${Math.max((Number(x.quantidade || 0) / max) * 100, 4)}%"></i></div>`;
    el.productList.appendChild(row);
  });
}

function renderHistory() {
  const list = dados.historico || [];
  el.historyBody.replaceChildren();
  el.historyCount.textContent = `${list.length} registro(s)`;
  el.historyEmpty.hidden = list.length > 0;
  
  list.forEach((x) => {
    const tr = document.createElement('tr');
    const tipo = x.tipo === 'ENTRADA' ? 'Entrada' : 'Saída';
    tr.innerHTML = `<td>${esc(dataCurta(x.criadoEm))}</td><td>${esc(x.produto)}<small> ${esc(x.codigo)}</small></td><td><span class="report-type ${String(x.tipo || '').toLowerCase()}">${tipo}</span></td><td>${esc(num(x.quantidade))}</td><td>${esc(x.responsavel)}</td>`;
    el.historyBody.appendChild(tr);
  });
}

function render() {
  const r = dados.resumo || {};
  el.movements.textContent = window.BabycareUI.formatarNumero(r.movimentacoes || 0);
  el.entries.textContent = num(r.entradas);
  el.exits.textContent = num(r.saidas);
  el.products.textContent = window.BabycareUI.formatarNumero(r.produtosMovimentados || 0);
  
  renderChart();
  renderCategories();
  renderProducts();
  renderHistory();
}

async function carregar() {
  if (el.error) el.error.hidden = true;
  window.BabycareUI.mostrarCarregamento('Gerando relatório...');
  try {
    dados = await api();
    preencherFiltros();
    render();
  } catch (x) {
    if ([401, 403].includes(x.status)) {
      location.href = '/pages/login.html';
      return;
    }
    if (el.error) {
      el.error.textContent = x.message;
      el.error.hidden = false;
    }
    window.BabycareUI.mostrarToast(x.message, 'error');
  } finally {
    window.BabycareUI.esconderCarregamento();
  }
}

function atualizarUsuario() {
  const raw = localStorage.getItem('babycareUsuario') || sessionStorage.getItem('babycareUsuario') || localStorage.getItem('babycareUser') || sessionStorage.getItem('babycareUser');
  let u = {};
  try { u = raw ? JSON.parse(raw) : {}; } catch (e) {}
  
  const nome = u.nome?.trim() || 'Usuário Babycare';
  const perfil = String(u.perfil || 'Perfil de acesso').replace(/_/g, ' ').toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (x) => x.toLocaleUpperCase('pt-BR'));
  const parts = nome.split(/\s+/).filter(Boolean);
  const ini = (parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : nome.slice(0, 2)).toUpperCase();
  
  ['sidebarUserName', 'topbarUserName'].forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.textContent = nome;
  });
  ['sidebarUserRole', 'topbarUserRole'].forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.textContent = perfil;
  });
  ['sidebarAvatar', 'topbarAvatar'].forEach((id) => {
    const x = document.getElementById(id);
    if (x) x.textContent = ini;
  });
}

function configurar() {
  atualizarUsuario();
  [el.period, el.type, el.category, el.product].forEach((x) => x?.addEventListener('change', carregar));
  el.refresh?.addEventListener('click', carregar);
  el.open?.addEventListener('click', () => document.body.classList.add('sidebar-open'));
  el.close?.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  
  document.querySelectorAll('.nav-link').forEach((x) => x.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
  
  el.side?.addEventListener('input', () => {
    const t = String(el.side?.value || '').toLocaleLowerCase('pt-BR');
    document.querySelectorAll('.main-nav .nav-link').forEach((x) => x.hidden = Boolean(t) && !x.textContent.toLocaleLowerCase('pt-BR').includes(t));
  });
  
  el.bell?.addEventListener('click', () => window.BabycareUI.mostrarToast('Relatório atualizado a partir dos dados do banco.'));
  el.logout?.addEventListener('click', () => {
    localStorage.removeItem('babycareToken');
    sessionStorage.removeItem('babycareToken');
    location.href = '/pages/login.html';
  });
}

window.addEventListener('load', () => {
  configurar();
  carregar();
});