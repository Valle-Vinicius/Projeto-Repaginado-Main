const ESTOQUE_API_URL = `${window.BabycareUI.API_URL}/api/estoque`;

const estoqueElementos = {
  total: document.querySelector('#totalStock'),
  baixo: document.querySelector('#lowStockProducts'),
  semEstoque: document.querySelector('#outOfStockProducts'),
  movimentacoesHoje: document.querySelector('#todayMovements'),
  alerta: document.querySelector('#estoqueAlert'),
  alertaTexto: document.querySelector('#estoqueAlertText'),
  busca: document.querySelector('#estoqueSearch'),
  categoria: document.querySelector('#estoqueCategory'),
  status: document.querySelector('#estoqueStatus'),
  ordenacao: document.querySelector('#estoqueOrdenacao'),
  sidebarBusca: document.querySelector('#sidebarSearch'),
  topbarBusca: document.querySelector('#topbarSearch'),
  notificacao: document.querySelector('#notificationButton'),
  abrirSidebar: document.querySelector('#openSidebarButton'),
  fecharSidebar: document.querySelector('#closeSidebarButton'),
  corpoTabela: document.querySelector('#inventoryBody'),
  tabelaVazia: document.querySelector('#inventoryEmpty'),
  quantidadeResultados: document.querySelector('#inventoryResultCount'),
  corpoMovimentacoes: document.querySelector('#movementsBody'),
  movimentacoesVazias: document.querySelector('#movementsEmpty'),
  entrada: document.querySelector('#entradaButton'),
  saida: document.querySelector('#saidaButton'),
  logout: document.querySelector('#logoutButton'),
  localizacao: document.querySelector('#movementLocation'),
  localizacaoCampo: document.querySelector('#movementLocationField'),
  validadeCampo: document.querySelector('#movementExpiration')?.closest('.modal-field'),
  modal: document.querySelector('#movementModal'),
  modalTitulo: document.querySelector('#movementModalTitle'),
  modalDescricao: document.querySelector('#movementModalDescription'),
  modalFechar: document.querySelector('#closeMovementModal'),
  formulario: document.querySelector('#movementForm'),
  tipo: document.querySelector('#movementType'),
  produto: document.querySelector('#movementProduct'),
  quantidade: document.querySelector('#movementQuantity'),
  motivo: document.querySelector('#movementReason'),
  lote: document.querySelector('#movementLot'),
  loteLabel: document.querySelector('#movementLotLabel'),
  validade: document.querySelector('#movementExpiration'),
  observacao: document.querySelector('#movementNote'),
  estoqueDisponivel: document.querySelector('#availableStock'),
  erro: document.querySelector('#movementError'),
  cancelar: document.querySelector('#cancelMovement'),
  enviar: document.querySelector('#submitMovement'),
  verHistorico: document.querySelector('#viewMovementsButton')
};

let estoqueDados = {
  resumo: null,
  categorias: [],
  produtos: [],
  movimentacoes: [],
  localizacoes: []
};

function obterToken() {
  return localStorage.getItem('babycareToken') || sessionStorage.getItem('babycareToken');
}

function obterUsuario() {
  const salvo = localStorage.getItem('babycareUsuario') || sessionStorage.getItem('babycareUsuario');
  try {
    return salvo ? JSON.parse(salvo) : null;
  } catch (erro) {
    return null;
  }
}

function configurarUsuario() {
  const usuario = obterUsuario();
  const nome = usuario?.nome || 'Usuário Babycare';
  const perfil = usuario?.perfil || 'OPERADOR_ESTOQUE';
  const perfilFormatado = perfil.replaceAll('_', ' ').toLowerCase().replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('') || 'U';

  document.querySelector('#sidebarUserName').textContent = nome;
  document.querySelector('#sidebarUserRole').textContent = perfilFormatado;
  document.querySelector('#topbarUserName').textContent = nome;
  document.querySelector('#topbarUserRole').textContent = perfilFormatado;
  document.querySelector('#sidebarAvatar').textContent = iniciais;
  document.querySelector('#topbarAvatar').textContent = iniciais;
}

async function requisitarAPI(caminho = '', opcoes = {}) {
  const token = obterToken();
  const resposta = await fetch(`${ESTOQUE_API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opcoes.headers || {})
    }
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) {
    localStorage.removeItem('babycareToken');
    localStorage.removeItem('babycareUsuario');
    sessionStorage.removeItem('babycareToken');
    sessionStorage.removeItem('babycareUsuario');
    window.location.replace('./login.html');
    throw new Error('Sessão expirada.');
  }

  if (!resposta.ok) {
    throw new Error(corpo.mensagem || 'Não foi possível consultar o estoque.');
  }

  return corpo;
}

function definirMetricas(valor = '—') {
  estoqueElementos.total.textContent = valor;
  estoqueElementos.baixo.textContent = valor;
  estoqueElementos.semEstoque.textContent = valor;
  estoqueElementos.movimentacoesHoje.textContent = valor;
}

function preencherCategorias(categorias) {
  const valorAtual = estoqueElementos.categoria.value;
  estoqueElementos.categoria.replaceChildren(new Option('Todas', ''));
  categorias.forEach((categoria) => {
    estoqueElementos.categoria.appendChild(new Option(categoria.nome, categoria.id));
  });
  estoqueElementos.categoria.value = categorias.some((categoria) => String(categoria.id) === valorAtual) ? valorAtual : '';
}

function preencherLocalizacoes(localizacoes) {
  estoqueElementos.localizacao.replaceChildren(new Option('Selecione uma localização', ''));
  localizacoes.forEach((localizacao) => {
    estoqueElementos.localizacao.appendChild(new Option(localizacao.nome, localizacao.id));
  });
}

function renderizarResumo() {
  const resumo = estoqueDados.resumo;
  if (!resumo) {
    definirMetricas();
    estoqueElementos.alerta.hidden = true;
    return;
  }

  estoqueElementos.total.textContent = window.BabycareUI.formatarNumero(resumo.estoqueTotal);
  estoqueElementos.baixo.textContent = window.BabycareUI.formatarNumero(resumo.estoqueBaixo);
  estoqueElementos.semEstoque.textContent = window.BabycareUI.formatarNumero(resumo.semEstoque);
  estoqueElementos.movimentacoesHoje.textContent = window.BabycareUI.formatarNumero(resumo.movimentacoesHoje);

  const quantidadeAtencao = Number(resumo.estoqueBaixo || 0) + Number(resumo.semEstoque || 0);
  estoqueElementos.alerta.hidden = quantidadeAtencao === 0;
  if (quantidadeAtencao > 0) {
    estoqueElementos.alertaTexto.textContent = `${window.BabycareUI.formatarNumero(quantidadeAtencao)} ${quantidadeAtencao === 1 ? 'produto precisa' : 'produtos precisam'} de atenção no estoque.`;
  }
}

function obterProdutosFiltrados() {
  const termo = estoqueElementos.busca.value.trim().toLowerCase();
  const categoriaId = estoqueElementos.categoria.value;
  const status = estoqueElementos.status.value;
  const ordenacao = estoqueElementos.ordenacao.value;

  const filtrados = estoqueDados.produtos.filter((produto) => {
    const pesquisavel = `${produto.nome} ${produto.codigo} ${produto.categoria}`.toLowerCase();
    return (!termo || pesquisavel.includes(termo))
      && (!categoriaId || String(produto.categoriaId) === categoriaId)
      && (!status || produto.status === status);
  });

  return filtrados.sort((a, b) => {
    if (ordenacao === 'estoque-menor') return a.estoque - b.estoque || a.nome.localeCompare(b.nome, 'pt-BR');
    if (ordenacao === 'estoque-maior') return b.estoque - a.estoque || a.nome.localeCompare(b.nome, 'pt-BR');
    if (ordenacao === 'movimentacao') return new Date(b.ultimaMovimentacao || 0) - new Date(a.ultimaMovimentacao || 0);
    return a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

function criarCelula(texto, classe = '') {
  const celula = document.createElement('td');
  celula.className = classe;
  celula.textContent = texto ?? '—';
  return celula;
}

function criarLinhaProduto(produto) {
  const linha = document.createElement('tr');
  const produtoCelula = document.createElement('td');
  const produtoPrincipal = document.createElement('div');
  const avatar = document.createElement('span');
  const texto = document.createElement('div');
  const nome = document.createElement('span');
  const codigo = document.createElement('small');
  const status = document.createElement('span');
  const statusCelula = document.createElement('td');
  const acaoCelula = document.createElement('td');
  const acao = document.createElement('button');

  produtoPrincipal.className = 'estoque-produto-cell';
  avatar.className = 'estoque-produto-avatar';
  avatar.textContent = produto.nome.charAt(0).toUpperCase();
  texto.className = 'estoque-produto-texto';
  nome.className = 'estoque-produto-nome';
  nome.textContent = produto.nome;       
  codigo.className = 'estoque-produto-sku';
  codigo.textContent = produto.codigo || 'Sem código';
  texto.append(nome, codigo);
  produtoPrincipal.append(avatar, texto);
  produtoCelula.appendChild(produtoPrincipal);

  status.className = `estoque-status ${produto.status.toLowerCase().replaceAll('_', '-')}`;
  status.textContent = produto.status === 'SEM_ESTOQUE' ? 'Sem estoque' : produto.status === 'BAIXO' ? 'Estoque baixo' : 'Normal';
  statusCelula.appendChild(status);

  acao.className = 'estoque-table-action';
  acao.type = 'button';
  acao.title = `Registrar saída de ${produto.nome}`;
  acao.setAttribute('aria-label', `Registrar saída de ${produto.nome}`);
  acao.textContent = '⋮';
  acao.addEventListener('click', () => abrirModal('SAIDA', produto.id));
  acaoCelula.appendChild(acao);

  linha.append(
    produtoCelula,
    criarCelula(produto.categoria),
    criarCelula(window.BabycareUI.formatarNumero(produto.estoque), 'estoque-quantidade'),
    criarCelula(window.BabycareUI.formatarNumero(produto.estoqueMinimo), 'estoque-minimo'),
    statusCelula,
    criarCelula(window.BabycareUI.formatarDataHora(produto.ultimaMovimentacao)),
    acaoCelula
  );

  return linha;
}

function renderizarTabela() {
  const produtos = obterProdutosFiltrados();
  estoqueElementos.corpoTabela.replaceChildren(...produtos.map(criarLinhaProduto));
  estoqueElementos.tabelaVazia.hidden = produtos.length > 0;
  estoqueElementos.quantidadeResultados.textContent = `${window.BabycareUI.formatarNumero(produtos.length)} ${produtos.length === 1 ? 'produto' : 'produtos'}`;
}

function obterMotivo(observacao) {
  const texto = String(observacao || '').trim();
  if (!texto) return '—';
  const encontrado = texto.match(/^Motivo:\s*([^|]+)/i);
  return encontrado ? encontrado[1].trim() : texto;
}

function criarLinhaMovimentacao(movimentacao) {
  const linha = document.createElement('tr');
  const tipo = movimentacao.tipo === 'ENTRADA' ? 'entrada' : 'saida';
  const tipoCelula = document.createElement('td');
  const tipoTexto = document.createElement('span');
  const quantidade = document.createElement('td');

  tipoTexto.className = `movimentacao-tipo ${tipo}`;
  tipoTexto.textContent = movimentacao.tipo === 'ENTRADA' ? 'Entrada' : 'Saída';
  tipoCelula.appendChild(tipoTexto);
  quantidade.className = `movimentacao-quantidade ${tipo}`;
  quantidade.textContent = `${movimentacao.tipo === 'ENTRADA' ? '+' : '-'}${window.BabycareUI.formatarNumero(movimentacao.quantidade)}`;

  linha.append(
    criarCelula(window.BabycareUI.formatarDataHora(movimentacao.data)),
    criarCelula(movimentacao.produto),
    tipoCelula,
    quantidade,
    criarCelula(movimentacao.responsavel),
    criarCelula(obterMotivo(movimentacao.observacao))
  );
  return linha;
}

function renderizarMovimentacoes() {
  const movimentacoes = estoqueDados.movimentacoes || [];
  estoqueElementos.corpoMovimentacoes.replaceChildren(...movimentacoes.map(criarLinhaMovimentacao));
  estoqueElementos.movimentacoesVazias.hidden = movimentacoes.length > 0;
}

function renderizarTudo() {
  renderizarResumo();
  renderizarTabela();
  renderizarMovimentacoes();
}

async function carregarEstoque() {
  window.BabycareUI.mostrarCarregamento('Consultando estoque no banco...');
  try {
    const dados = await requisitarAPI();
    estoqueDados = {
      resumo: dados.resumo || null,
      categorias: Array.isArray(dados.categorias) ? dados.categorias : [],
      produtos: Array.isArray(dados.produtos) ? dados.produtos : [],
      movimentacoes: Array.isArray(dados.movimentacoes) ? dados.movimentacoes : [],
      localizacoes: Array.isArray(dados.localizacoes) ? dados.localizacoes : []
    };
    preencherCategorias(estoqueDados.categorias);
    preencherLocalizacoes(estoqueDados.localizacoes);
    renderizarTudo();
  } catch (erro) {
    definirMetricas();
    estoqueDados = { resumo: null, categorias: [], produtos: [], movimentacoes: [], localizacoes: [] };
    estoqueElementos.corpoTabela.replaceChildren();
    estoqueElementos.corpoMovimentacoes.replaceChildren();
    estoqueElementos.tabelaVazia.hidden = false;
    estoqueElementos.movimentacoesVazias.hidden = false;
    estoqueElementos.quantidadeResultados.textContent = 'Nenhum resultado';
    estoqueElementos.alerta.hidden = false;
    estoqueElementos.alertaTexto.textContent = erro.message || 'Não foi possível carregar os dados reais do estoque.';
    window.BabycareUI.mostrarToast(erro.message || 'Não foi possível carregar o estoque.', 'error');
  } finally {
    window.BabycareUI.esconderCarregamento();
  }
}

function preencherProdutosModal() {
  const produtosAtivos = estoqueDados.produtos.filter((produto) => produto.statusProduto === 'ATIVO');
  estoqueElementos.produto.replaceChildren(new Option('Selecione um produto', ''));
  produtosAtivos.forEach((produto) => {
    estoqueElementos.produto.appendChild(new Option(`${produto.nome} — ${produto.codigo}`, produto.id));
  });
}

function preencherMotivos(tipo) {
  const motivos = tipo === 'ENTRADA'
    ? [['RECEBIMENTO', 'Recebimento de fornecedor'], ['DEVOLUCAO', 'Devolução'], ['AJUSTE', 'Ajuste de estoque'], ['OUTRO', 'Outro motivo']]
    : [['EXPEDICAO', 'Expedição'], ['PERDA', 'Perda ou avaria'], ['AJUSTE', 'Ajuste de estoque'], ['OUTRO', 'Outro motivo']];
  estoqueElementos.motivo.replaceChildren(...motivos.map(([valor, texto]) => new Option(texto, valor)));
}

function atualizarInformacaoProduto() {
  const produto = estoqueDados.produtos.find((item) => String(item.id) === estoqueElementos.produto.value);
  const entrada = estoqueElementos.tipo.value === 'ENTRADA';

  if (!produto) {
    estoqueElementos.estoqueDisponivel.hidden = true;
    estoqueElementos.validadeCampo.hidden = true;
    estoqueElementos.validade.required = false;
    estoqueElementos.validade.value = '';
    return;
  }

  estoqueElementos.estoqueDisponivel.hidden = false;
  estoqueElementos.estoqueDisponivel.textContent = `Estoque atual: ${window.BabycareUI.formatarNumero(produto.estoque)} ${produto.unidade || 'UN'} disponíveis.`;

  const exigeValidade = entrada && produto.possuiValidade;
  estoqueElementos.validadeCampo.hidden = !exigeValidade;
  estoqueElementos.validade.required = exigeValidade;
  estoqueElementos.validade.disabled = !exigeValidade;
  if (!exigeValidade) estoqueElementos.validade.value = '';
}

function mostrarErro(texto) {
  estoqueElementos.erro.textContent = texto;
  estoqueElementos.erro.hidden = !texto;
}

function atualizarRegraLote(tipo) {
  const entrada = tipo === 'ENTRADA';
  estoqueElementos.lote.required = entrada;
  estoqueElementos.loteLabel.hidden = !entrada;
  estoqueElementos.loteLabel.querySelector('span').textContent = entrada ? '*' : 'opcional';
  estoqueElementos.loteLabel.querySelector('span').className = entrada ? '' : 'optional-label';
  estoqueElementos.localizacao.required = entrada;
  estoqueElementos.localizacaoCampo.hidden = !entrada;
  estoqueElementos.validadeCampo.hidden = !entrada;
  estoqueElementos.validade.disabled = !entrada;
  if (!entrada) {
    estoqueElementos.validade.value = '';
    estoqueElementos.localizacao.value = '';
  }
}

function abrirModal(tipo, produtoId = '') {
  estoqueElementos.tipo.value = tipo;
  estoqueElementos.modalTitulo.textContent = tipo === 'ENTRADA' ? 'Registrar entrada' : 'Registrar saída';
  estoqueElementos.modalDescricao.textContent = tipo === 'ENTRADA'
    ? 'Registre a entrada no lote recebido para atualizar o saldo real.'
    : 'Registre uma saída. O sistema usará FIFO quando nenhum lote for informado.';
  estoqueElementos.enviar.textContent = tipo === 'ENTRADA' ? 'Registrar entrada' : 'Registrar saída';
  preencherMotivos(tipo);
  preencherProdutosModal();
  atualizarRegraLote(tipo);
  estoqueElementos.produto.value = produtoId ? String(produtoId) : '';
  estoqueElementos.quantidade.value = '';
  estoqueElementos.lote.value = '';
  estoqueElementos.validade.value = '';
  estoqueElementos.observacao.value = '';
  mostrarErro('');
  atualizarInformacaoProduto();
  estoqueElementos.modal.hidden = false;
  document.body.classList.add('modal-open');
  window.setTimeout(() => estoqueElementos.produto.focus(), 0);
}

function fecharModal() {
  estoqueElementos.modal.hidden = true;
  document.body.classList.remove('modal-open');
}

function validarMovimentacao() {
  const produto = estoqueDados.produtos.find((item) => String(item.id) === estoqueElementos.produto.value);
  const quantidade = Number(estoqueElementos.quantidade.value);
  const tipo = estoqueElementos.tipo.value;

  if (!produto) return 'Selecione um produto ativo.';
  if (!Number.isFinite(quantidade) || quantidade <= 0) return 'A quantidade deve ser maior que zero.';
  if (tipo === 'ENTRADA' && !estoqueElementos.lote.value.trim()) return 'Informe o número do lote para registrar uma entrada.';
  if (tipo === 'ENTRADA' && !estoqueElementos.localizacao.value) return 'Selecione a localização do lote recebido.';
  if (tipo === 'ENTRADA' && produto.possuiValidade && !estoqueElementos.validade.value) return 'Informe a validade do lote para este produto.';
  if (tipo === 'SAIDA' && quantidade > Number(produto.estoque)) {
    return `Não é possível registrar a saída. Disponível: ${window.BabycareUI.formatarNumero(produto.estoque)} unidades.`;
  }
  if (estoqueElementos.motivo.value === 'AJUSTE' && !estoqueElementos.observacao.value.trim()) {
    return 'Informe uma observação para registrar um ajuste de estoque.';
  }
  return '';
}

async function registrarMovimentacao(evento) {
  evento.preventDefault();
  const erro = validarMovimentacao();
  if (erro) {
    mostrarErro(erro);
    return;
  }

  const tipo = estoqueElementos.tipo.value;
  const motivo = estoqueElementos.motivo.options[estoqueElementos.motivo.selectedIndex]?.textContent || '';
  const payload = {
    tipo,
    produtoId: Number(estoqueElementos.produto.value),
    quantidade: Number(estoqueElementos.quantidade.value),
    motivo,
    observacao: estoqueElementos.observacao.value.trim() || null,
    numeroLote: estoqueElementos.lote.value.trim() || null,
    dataValidade: estoqueElementos.validade.value || null,
    localizacaoId: estoqueElementos.localizacao.value ? Number(estoqueElementos.localizacao.value) : null
  };

  estoqueElementos.enviar.disabled = true;
  estoqueElementos.enviar.textContent = 'Registrando...';
  mostrarErro('');

  try {
    await requisitarAPI('/movimentacoes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    fecharModal();
    await carregarEstoque();
    window.BabycareUI.mostrarToast('Movimentação registrada no estoque real.', 'success');
  } catch (erroMovimentacao) {
    mostrarErro(erroMovimentacao.message || 'Não foi possível registrar a movimentação.');
  } finally {
    estoqueElementos.enviar.disabled = false;
    estoqueElementos.enviar.textContent = tipo === 'ENTRADA' ? 'Registrar entrada' : 'Registrar saída';
  }
}

function configurarEventos() {
  [estoqueElementos.busca, estoqueElementos.categoria, estoqueElementos.status, estoqueElementos.ordenacao]
    .forEach((elemento) => elemento.addEventListener('input', renderizarTabela));

  estoqueElementos.abrirSidebar?.addEventListener('click', () => document.body.classList.add('sidebar-open'));
  estoqueElementos.fecharSidebar?.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });

  estoqueElementos.notificacao?.addEventListener('click', () => {
    const alertas = Number(estoqueDados.resumo?.estoqueBaixo || 0) + Number(estoqueDados.resumo?.semEstoque || 0);
    window.BabycareUI.mostrarToast(alertas ? `${alertas} produto(s) precisam de atenção no estoque.` : 'Você não possui novas notificações.');
  });

  estoqueElementos.topbarBusca?.addEventListener('search', () => {
    if (estoqueElementos.topbarBusca.value.trim()) {
      window.BabycareUI.mostrarToast('Use a busca de estoque para filtrar os produtos.');
    }
  });

  estoqueElementos.sidebarBusca?.addEventListener('input', () => {
    const termo = estoqueElementos.sidebarBusca.value.trim().toLocaleLowerCase('pt-BR');
    document.querySelectorAll('.main-nav .nav-link').forEach((item) => {
      item.hidden = Boolean(termo) && !item.textContent.toLocaleLowerCase('pt-BR').includes(termo);
    });
  });

  estoqueElementos.entrada.addEventListener('click', () => abrirModal('ENTRADA'));
  estoqueElementos.saida.addEventListener('click', () => abrirModal('SAIDA'));
  estoqueElementos.produto.addEventListener('change', atualizarInformacaoProduto);
  estoqueElementos.formulario.addEventListener('submit', registrarMovimentacao);
  estoqueElementos.modalFechar.addEventListener('click', fecharModal);
  estoqueElementos.cancelar.addEventListener('click', fecharModal);
  estoqueElementos.verHistorico.addEventListener('click', () => document.querySelector('.movimentacoes-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }));

  estoqueElementos.modal.addEventListener('click', (evento) => {
    if (evento.target === estoqueElementos.modal) fecharModal();
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !estoqueElementos.modal.hidden) fecharModal();
  });

  estoqueElementos.logout.addEventListener('click', () => {
    localStorage.removeItem('babycareToken');
    localStorage.removeItem('babycareUsuario');
    sessionStorage.removeItem('babycareToken');
    sessionStorage.removeItem('babycareUsuario');
    window.BabycareUI.transicionarPara('./login.html');
  });

  document.querySelectorAll('[data-coming-soon]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      evento.preventDefault();
      window.BabycareUI.mostrarToast(`O módulo ${link.dataset.comingSoon} será desenvolvido na próxima etapa.`);
    });
  });

}

async function inicializarEstoque() {
  if (!obterToken()) {
    window.location.replace('./login.html');
    return;
  }

  configurarUsuario();
  configurarEventos();
  await carregarEstoque();
}

window.addEventListener('load', inicializarEstoque);
