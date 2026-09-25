const RECEBIMENTOS_API_URL = `${window.BabycareUI.API_URL}/api/recebimentos`;
const ESTOQUE_API_URL = `${window.BabycareUI.API_URL}/api/estoque`;

const el = {
  sidebarBusca: document.querySelector('#sidebarSearch'), topbarBusca: document.querySelector('#topbarSearch'), abrirSidebar: document.querySelector('#openSidebarButton'), fecharSidebar: document.querySelector('#closeSidebarButton'), logout: document.querySelector('#logoutButton'), notificacao: document.querySelector('#notificationButton'),
  novo: document.querySelector('#newReceiptButton'), busca: document.querySelector('#receiptSearch'), periodo: document.querySelector('#receiptPeriod'), corpo: document.querySelector('#receiptBody'), vazio: document.querySelector('#receiptEmpty'), contador: document.querySelector('#receiptCount'), hoje: document.querySelector('#todayReceipts'), unidades: document.querySelector('#todayUnits'), ultimaData: document.querySelector('#lastReceiptDate'), ultimoProduto: document.querySelector('#lastReceiptProduct'), modal: document.querySelector('#receiptModal'), fecharModal: document.querySelector('#closeReceiptModal'), cancelar: document.querySelector('#cancelReceipt'), formulario: document.querySelector('#receiptForm'), produto: document.querySelector('#receiptProduct'), quantidade: document.querySelector('#receiptQuantity'), lote: document.querySelector('#receiptLot'), fornecedor: document.querySelector('#receiptSupplier'), documento: document.querySelector('#receiptDocument'), validade: document.querySelector('#receiptExpiration'), validadeCampo: document.querySelector('#receiptExpirationField'), localizacao: document.querySelector('#receiptLocation'), observacao: document.querySelector('#receiptNote'), erro: document.querySelector('#receiptError'), enviar: document.querySelector('#submitReceipt')
};

let recebimentos = [];
let produtos = [];
let localizacoes = [];
const CHAVES_USUARIO = ['babycareUsuario', 'babycareUser'];

function obterUsuarioSessao() {
  for (const chave of CHAVES_USUARIO) {
    const valores = [localStorage.getItem(chave), sessionStorage.getItem(chave)];
    for (const valor of valores) {
      if (!valor) continue;
      try { const usuario = JSON.parse(valor); if (usuario && typeof usuario === 'object') return usuario; } catch (erro) { /* sessão antiga inválida */ }
    }
  }
  return {};
}
function iniciais(nome) { const partes = String(nome || '').trim().split(/\s+/u).filter(Boolean); return partes.length > 1 ? `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase() : (partes[0]?.slice(0, 2).toUpperCase() || 'U'); }
function perfilExibicao(perfil) { return String(perfil || 'Perfil de acesso').replace(/_/gu, ' ').toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/gu, (letra) => letra.toLocaleUpperCase('pt-BR')); }
function atualizarUsuario() {
  const usuario = obterUsuarioSessao(); const nome = typeof usuario.nome === 'string' && usuario.nome.trim() ? usuario.nome.trim() : 'Usuário Babycare'; const perfil = perfilExibicao(usuario.perfil); const avatar = iniciais(nome);
  ['sidebarUserName', 'topbarUserName'].forEach((id) => { const item = document.getElementById(id); if (item) item.textContent = nome; });
  ['sidebarUserRole', 'topbarUserRole'].forEach((id) => { const item = document.getElementById(id); if (item) item.textContent = perfil; });
  ['sidebarAvatar', 'topbarAvatar'].forEach((id) => { const item = document.getElementById(id); if (item) item.textContent = avatar; });
}

function token() { return localStorage.getItem('babycareToken') || sessionStorage.getItem('babycareToken'); }
function escapar(valor) { const div = document.createElement('div'); div.textContent = valor ?? ''; return div.innerHTML; }
function numero(valor) { return window.BabycareUI.formatarNumero(Number(valor || 0), 3).replace(/,?0+$/, '').replace(/,$/, ''); }
function data(valor) { return valor ? window.BabycareUI.formatarDataHora(valor) : '—'; }

async function requisitar(url, opcoes = {}) {
  const resposta = await fetch(url, { ...opcoes, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(opcoes.headers || {}) } });
  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) { const erro = new Error(corpo.mensagem || 'Não foi possível concluir a operação.'); erro.status = resposta.status; throw erro; }
  return corpo;
}

function preencherProdutos() {
  el.produto.replaceChildren(new Option('Selecione um produto', ''));
  produtos.forEach((produto) => el.produto.appendChild(new Option(`${produto.nome} — ${produto.codigo}`, produto.id)));
}
function preencherLocalizacoes() {
  el.localizacao.replaceChildren(new Option('Selecione uma localização', ''));
  localizacoes.forEach((localizacao) => el.localizacao.appendChild(new Option(localizacao.nome, localizacao.id)));
}
function atualizarValidade() {
  const produto = produtos.find((item) => String(item.id) === el.produto.value);
  const exige = Boolean(produto?.possuiValidade);
  el.validadeCampo.hidden = !exige;
  el.validade.required = exige;
  el.validade.disabled = !exige;
  if (!exige) el.validade.value = '';
}

function registrosFiltrados() {
  const termo = el.busca.value.trim().toLocaleLowerCase('pt-BR');
  const agora = Date.now();
  const dias = { HOJE: 1, '7D': 7, '30D': 30 }[el.periodo.value];
  return recebimentos.filter((item) => {
    const texto = [item.produto, item.codigo, item.numeroLote, item.fornecedor, item.documento, item.localizacao].join(' ').toLocaleLowerCase('pt-BR');
    const dentroPeriodo = !dias || (agora - new Date(item.criadoEm).getTime()) <= dias * 86400000;
    return (!termo || texto.includes(termo)) && dentroPeriodo;
  });
}

function renderizarResumo() {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const entradasHoje = recebimentos.filter((item) => new Date(item.criadoEm) >= hoje);
  el.hoje.textContent = window.BabycareUI.formatarNumero(entradasHoje.length);
  el.unidades.textContent = numero(entradasHoje.reduce((soma, item) => soma + Number(item.quantidade || 0), 0));
  el.ultimaData.textContent = recebimentos[0] ? data(recebimentos[0].criadoEm).split(',')[0] : '—';
  el.ultimoProduto.textContent = recebimentos[0]?.produto || 'Nenhum recebimento registrado';
}

function renderizarTabela() {
  const lista = registrosFiltrados();
  el.contador.textContent = `${lista.length} registro(s)`;
  el.corpo.replaceChildren();
  el.vazio.hidden = lista.length > 0;
  lista.forEach((item) => {
    const linha = document.createElement('tr');
    linha.innerHTML = `<td>${escapar(data(item.criadoEm))}</td><td class="recebimento-produto"><strong>${escapar(item.produto)}</strong><small>${escapar(item.codigo)}</small></td><td>${escapar(item.numeroLote || '—')}</td><td>${escapar(item.fornecedor || 'Não informado')}</td><td class="recebimento-quantidade">+${escapar(numero(item.quantidade))}</td><td>${escapar(item.dataValidade ? window.BabycareUI.formatarData(item.dataValidade) : 'Sem validade')}</td><td>${escapar(item.localizacao || 'Não informada')}</td><td>${escapar(item.responsavel)}</td>`;
    el.corpo.appendChild(linha);
  });
}

function mostrarErro(texto) { el.erro.textContent = texto || ''; el.erro.hidden = !texto; }
function abrirModal() { el.formulario.reset(); mostrarErro(''); atualizarValidade(); el.localizacao.disabled = false; el.modal.hidden = false; document.body.classList.add('modal-open'); window.setTimeout(() => el.produto.focus(), 0); }
function fecharModal() { el.modal.hidden = true; document.body.classList.remove('modal-open'); }

async function carregar() {
  window.BabycareUI.mostrarCarregamento('Carregando recebimentos...');
  try {
    const [historico, estoque] = await Promise.all([requisitar(RECEBIMENTOS_API_URL), requisitar(ESTOQUE_API_URL)]);
    recebimentos = Array.isArray(historico.recebimentos) ? historico.recebimentos : [];
    produtos = Array.isArray(estoque.produtos) ? estoque.produtos : [];
    localizacoes = Array.isArray(estoque.localizacoes) ? estoque.localizacoes : [];
    preencherProdutos(); preencherLocalizacoes(); renderizarResumo(); renderizarTabela();
  } catch (erro) {
    if ([401, 403].includes(erro.status)) { window.location.href = '/pages/login.html'; return; }
    el.contador.textContent = 'Erro ao carregar'; el.vazio.hidden = false; el.vazio.textContent = erro.message; window.BabycareUI.mostrarToast(erro.message, 'error');
  } finally { window.BabycareUI.esconderCarregamento(); }
}

async function enviar(evento) {
  evento.preventDefault();
  const produto = produtos.find((item) => String(item.id) === el.produto.value);
  if (!produto) return mostrarErro('Selecione um produto.');
  if (!el.lote.value.trim()) return mostrarErro('Informe o número do lote.');
  if (!el.localizacao.value) return mostrarErro('Selecione a localização do lote.');
  if (produto.possuiValidade && !el.validade.value) return mostrarErro('Informe a validade deste produto.');
  const quantidade = Number(el.quantidade.value);
  if (!Number.isFinite(quantidade) || quantidade <= 0) return mostrarErro('Informe uma quantidade maior que zero.');

  el.enviar.disabled = true; mostrarErro('');
  try {
    await requisitar(RECEBIMENTOS_API_URL, { method: 'POST', body: JSON.stringify({ tipo: 'ENTRADA', produtoId: Number(produto.id), quantidade, numeroLote: el.lote.value.trim(), fornecedor: el.fornecedor.value.trim() || null, documento: el.documento.value.trim() || null, dataValidade: el.validade.value || null, localizacaoId: Number(el.localizacao.value), motivo: 'Recebimento de fornecedor', observacao: el.observacao.value.trim() || null }) });
    fecharModal(); window.BabycareUI.mostrarToast('Recebimento registrado e estoque atualizado.'); await carregar();
  } catch (erro) { mostrarErro(erro.message); } finally { el.enviar.disabled = false; }
}

function configurar() {
  atualizarUsuario();
  [el.busca, el.periodo].forEach((item) => item.addEventListener('input', renderizarTabela));
  el.produto.addEventListener('change', atualizarValidade); el.novo.addEventListener('click', abrirModal); el.fecharModal.addEventListener('click', fecharModal); el.cancelar.addEventListener('click', fecharModal); el.formulario.addEventListener('submit', enviar);
  el.modal.addEventListener('click', (e) => { if (e.target === el.modal) fecharModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.modal.hidden) fecharModal(); });
  el.abrirSidebar?.addEventListener('click', () => document.body.classList.add('sidebar-open')); el.fecharSidebar?.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  document.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
  el.sidebarBusca?.addEventListener('input', () => { const termo = el.sidebarBusca.value.toLocaleLowerCase('pt-BR'); document.querySelectorAll('.main-nav .nav-link').forEach((item) => { item.hidden = Boolean(termo) && !item.textContent.toLocaleLowerCase('pt-BR').includes(termo); }); });
  el.topbarBusca?.addEventListener('search', () => { if (el.topbarBusca.value.trim()) window.BabycareUI.mostrarToast('Use a busca de recebimentos para filtrar o histórico.'); });
  el.notificacao?.addEventListener('click', () => window.BabycareUI.mostrarToast(recebimentos.length ? `${recebimentos.length} recebimento(s) carregado(s).` : 'Nenhum recebimento registrado.'));
  el.logout?.addEventListener('click', () => { localStorage.removeItem('babycareToken'); sessionStorage.removeItem('babycareToken'); window.location.href = '/pages/login.html'; });
}

window.addEventListener('load', () => { configurar(); carregar(); });
