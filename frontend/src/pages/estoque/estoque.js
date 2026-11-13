import { API_URL, fetchAPI } from '../../js/core/api.js';
import {
  salvarFiltros as salvarFiltrosCore,
  carregarFiltros as carregarFiltrosCore,
} from '../../js/core/index.js';
import {
  mostrarCarregamento,
  esconderCarregamento,
  formatarNumero,
  formatarDataHora,
  mostrarToast,
  conectarBuscaTopbar,
  fazerLogout as fazerLogoutCore,
} from '../../js/core/ui.js';

const ESTOQUE_API_URL = `${API_URL}/estoque`;

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
  camposExpedicao: document.querySelector('#shipmentFields'),
  destinatario: document.querySelector('#movementRecipient'),
  destino: document.querySelector('#movementDestination'),
  camposLote: document.querySelector('#lotFields'),
  lote: document.querySelector('#movementLot'),
  loteLabel: document.querySelector('#movementLotLabel'),
  validade: document.querySelector('#movementExpiration'),
  observacao: document.querySelector('#movementNote'),
  estoqueDisponivel: document.querySelector('#availableStock'),
  erro: document.querySelector('#movementError'),
  cancelar: document.querySelector('#cancelMovement'),
  enviar: document.querySelector('#submitMovement'),
  verHistorico: document.querySelector('#viewMovementsButton'),
};

let estoqueDados = {
  resumo: null,
  categorias: [],
  produtos: [],
  movimentacoes: [],
  localizacoes: [],
};

function obterUsuario() {
  const salvo =
    localStorage.getItem('babycareUsuario') || sessionStorage.getItem('babycareUsuario');
  try {
    return salvo ? JSON.parse(salvo) : null;
  } catch (erro) {
    return null;
  }
}

function configurarUsuario() {
  const usuario = obterUsuario();
  const nome = usuario?.nome || 'Usuário Babycare';
  const perfil = (usuario?.perfil || 'OPERADOR_ESTOQUE')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
  const iniciais =
    nome
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0].toUpperCase())
      .join('') || 'U';

  document.querySelector('#sidebarUserName').textContent = nome;
  document.querySelector('#sidebarUserRole').textContent = perfil;
  document.querySelector('#topbarUserName').textContent = nome;
  document.querySelector('#topbarUserRole').textContent = perfil;
  document.querySelector('#sidebarAvatar').textContent = iniciais;
  document.querySelector('#topbarAvatar').textContent = iniciais;
}

async function requisitarAPI(caminho, opcoes = {}) {
  const resposta = await fetchAPI(`${ESTOQUE_API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
    credentials: 'include',
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    throw new Error(corpo.mensagem || 'Não foi possível consultar o estoque.');
  }

  return corpo;
}

function definirMetricas() {
  const resumo = estoqueDados.resumo || {};
  estoqueElementos.total.textContent = formatarNumero(resumo.estoqueTotal ?? 0);
  estoqueElementos.baixo.textContent = formatarNumero(resumo.estoqueBaixo ?? 0);
  estoqueElementos.semEstoque.textContent = formatarNumero(resumo.semEstoque ?? 0);
  estoqueElementos.movimentacoesHoje.textContent = formatarNumero(resumo.movimentacoesHoje ?? 0);
}

function estadoEstoque(produto) {
  const estoque = Number(produto.estoqueAtual || 0);
  const minimo = Number(produto.estoqueMinimo || 0);
  if (estoque === 0) {
    return 'SEM_ESTOQUE';
  }
  if (estoque <= minimo) {
    return 'BAIXO';
  }
  return 'NORMAL';
}

function classeStatus(estado) {
  return (
    {
      NORMAL: 'normal',
      BAIXO: 'baixo',
      SEM_ESTOQUE: 'sem-estoque',
    }[estado] || 'normal'
  );
}

function textoStatus(estado) {
  return (
    {
      NORMAL: 'Normal',
      BAIXO: 'Estoque baixo',
      SEM_ESTOQUE: 'Sem estoque',
    }[estado] || estado
  );
}

function criarCelula(texto, classe = '') {
  const celula = document.createElement('td');
  celula.className = classe;
  celula.textContent = texto ?? '—';
  return celula;
}

function criarLinhaProduto(produto) {
  const linha = document.createElement('tr');
  const produtoCell = document.createElement('td');
  const avatar = document.createElement('span');
  const textoProduto = document.createElement('div');
  const nome = document.createElement('strong');
  const codigo = document.createElement('small');
  const statusCell = document.createElement('td');
  const status = document.createElement('span');
  const estado = estadoEstoque(produto);

  produtoCell.className = 'estoque-produto-cell';
  avatar.className = 'estoque-produto-avatar';
  avatar.textContent = String(produto.nome || '?').trim().charAt(0).toLocaleUpperCase('pt-BR');
  textoProduto.className = 'estoque-produto-texto';
  nome.className = 'estoque-produto-nome';
  nome.textContent = produto.nome || 'Produto sem nome';
  codigo.className = 'estoque-produto-sku';
  codigo.textContent = produto.codigo || 'Sem código';
  textoProduto.append(nome, codigo);
  produtoCell.append(avatar, textoProduto);

  statusCell.className = 'estoque-status-cell';
  status.className = `estoque-status ${classeStatus(estado)}`;
  status.textContent = textoStatus(estado);
  statusCell.appendChild(status);

  linha.append(
    produtoCell,
    criarCelula(produto.categoria || 'Sem categoria'),
    criarCelula(formatarNumero(produto.estoqueAtual), 'estoque-quantidade'),
    criarCelula(formatarNumero(produto.estoqueMinimo), 'estoque-minimo'),
    statusCell,
    criarCelula(
      produto.ultimaMovimentacao ? formatarDataHora(produto.ultimaMovimentacao) : '—',
      'estoque-movimentacao-data'
    ),
    criarCelula('')
  );

  return linha;
}

function criarLinhaMovimentacao(movimentacao) {
  const linha = document.createElement('tr');
  const tipo = String(movimentacao.tipo || '').toUpperCase();
  const tipoClasse = tipo === 'ENTRADA' ? 'entrada' : 'saida';
  const tipoLabel = tipo === 'ENTRADA' ? 'Entrada' : tipo === 'SAIDA' ? 'Saída' : tipo;
  const tipoCell = document.createElement('td');
  const tipoBadge = document.createElement('span');
  const quantidadeCell = document.createElement('td');
  const quantidade = formatarNumero(movimentacao.quantidade);

  tipoCell.className = 'movimentacao-tipo-cell';
  tipoBadge.className = `movimentacao-tipo ${tipoClasse}`;
  tipoBadge.textContent = tipoLabel || '—';
  tipoCell.appendChild(tipoBadge);

  quantidadeCell.className = `movimentacao-quantidade ${tipoClasse}`;
  quantidadeCell.textContent =
    tipo === 'ENTRADA' ? `+${quantidade}` : tipo === 'SAIDA' ? `−${quantidade}` : quantidade;

  linha.append(
    criarCelula(formatarDataHora(movimentacao.data), 'movimentacao-data'),
    criarCelula(movimentacao.produto || 'Produto não identificado', 'movimentacao-produto'),
    tipoCell,
    quantidadeCell,
    criarCelula(movimentacao.responsavel || '—', 'movimentacao-responsavel'),
    criarCelula(movimentacao.observacao || '—', 'movimentacao-motivo')
  );

  return linha;
}

function renderizarTabela() {
  const produtos = estoqueDados.produtos;
  const termo = estoqueElementos.busca.value.trim().toLowerCase();
  const categoriaId = estoqueElementos.categoria.value;
  const statusFiltro = estoqueElementos.status.value;
  const ordenacao = estoqueElementos.ordenacao.value;

  let filtrados = produtos.filter((produto) => {
    const textoBusca = `${produto.nome} ${produto.codigo} ${produto.categoria}`.toLowerCase();
    const estado = estadoEstoque(produto);
    return (
      (!termo || textoBusca.includes(termo)) &&
      (!categoriaId || String(produto.categoriaId) === categoriaId) &&
      (!statusFiltro || estado === statusFiltro)
    );
  });

  if (ordenacao === 'estoque-menor') {
    filtrados.sort((a, b) => Number(a.estoqueAtual || 0) - Number(b.estoqueAtual || 0));
  } else if (ordenacao === 'estoque-maior') {
    filtrados.sort((a, b) => Number(b.estoqueAtual || 0) - Number(a.estoqueAtual || 0));
  }

  estoqueElementos.tabelaVazia.hidden = filtrados.length > 0;
  estoqueElementos.quantidadeResultados.textContent = `${filtrados.length} resultado(s)`;
  estoqueElementos.corpoTabela.replaceChildren(...filtrados.map(criarLinhaProduto));
}

function preencherCategorias(categorias) {
  estoqueElementos.categoria.replaceChildren(new Option('Todas', ''));
  categorias.forEach((categoria) => {
    estoqueElementos.categoria.appendChild(new Option(categoria.nome, categoria.id));
  });
}

function preencherLocalizacoes(localizacoes) {
  estoqueElementos.localizacao.replaceChildren(new Option('Selecione uma localização', ''));
  localizacoes.forEach((localizacao) => {
    estoqueElementos.localizacao.appendChild(new Option(localizacao.nome, localizacao.id));
  });
}

function preencherProdutosModal() {
  const produtosAtivos = estoqueDados.produtos.filter(
    (produto) => produto.statusProduto === 'ATIVO'
  );
  estoqueElementos.produto.replaceChildren(new Option('Selecione um produto', ''));
  produtosAtivos.forEach((produto) => {
    estoqueElementos.produto.appendChild(
      new Option(`${produto.nome} — ${produto.codigo}`, produto.id)
    );
  });
}

function preencherMotivos(tipo) {
  const motivos =
    tipo === 'ENTRADA'
      ? [
          ['RECEBIMENTO', 'Recebimento de fornecedor'],
          ['DEVOLUCAO', 'Devolução'],
          ['AJUSTE', 'Ajuste de estoque'],
          ['OUTRO', 'Outro motivo'],
        ]
      : [
          ['EXPEDICAO', 'Expedição'],
          ['PERDA', 'Perda ou avaria'],
          ['AJUSTE', 'Ajuste de estoque'],
          ['OUTRO', 'Outro motivo'],
        ];
  estoqueElementos.motivo.replaceChildren(
    ...motivos.map(([valor, texto]) => new Option(texto, valor))
  );
}

function atualizarInformacaoProduto() {
  const produto = estoqueDados.produtos.find(
    (item) => String(item.id) === estoqueElementos.produto.value
  );
  const entrada = estoqueElementos.tipo.value === 'ENTRADA';

  if (!produto) {
    estoqueElementos.estoqueDisponivel.hidden = true;
    estoqueElementos.validadeCampo.hidden = true;
    estoqueElementos.validade.required = false;
    estoqueElementos.validade.disabled = true;
    return;
  }

  estoqueElementos.estoqueDisponivel.hidden = false;
  estoqueElementos.estoqueDisponivel.textContent = `Saldo disponível: ${formatarNumero(produto.estoqueAtual)} ${produto.unidade || 'unidade(s)'}`;

  const exigeValidade = entrada && Boolean(produto.possuiValidade);
  estoqueElementos.validadeCampo.hidden = !exigeValidade;
  estoqueElementos.validade.required = exigeValidade;
  estoqueElementos.validade.disabled = !exigeValidade;
  if (!exigeValidade) {
    estoqueElementos.validade.value = '';
  }
}

function abrirModal(tipo) {
  estoqueElementos.tipo.value = tipo;
  estoqueElementos.modalTitulo.textContent =
    tipo === 'ENTRADA' ? 'Registrar entrada' : 'Registrar saída';
  estoqueElementos.modalDescricao.textContent =
    tipo === 'ENTRADA'
      ? 'Registre a entrada no lote recebido para atualizar o saldo real.'
      : 'Informe o destinatário e o destino. A baixa seguirá FEFO, priorizando lotes válidos com vencimento mais próximo.';
  estoqueElementos.formulario.reset();
  const entrada = tipo === 'ENTRADA';
  estoqueElementos.camposLote.hidden = !entrada;
  estoqueElementos.camposExpedicao.hidden = entrada;
  estoqueElementos.destinatario.required = !entrada;
  estoqueElementos.destino.required = !entrada;
  estoqueElementos.validadeCampo.hidden = true;
  estoqueElementos.validade.required = false;
  estoqueElementos.validade.disabled = true;
  estoqueElementos.erro.hidden = true;
  estoqueElementos.estoqueDisponivel.hidden = true;
  estoqueElementos.modal.hidden = false;
  document.body.classList.add('modal-open');
  preencherProdutosModal();
  preencherMotivos(tipo);
  estoqueElementos.produto.focus();
}

function fecharModal() {
  estoqueElementos.modal.hidden = true;
  document.body.classList.remove('modal-open');
}

function mostrarErro(texto) {
  estoqueElementos.erro.textContent = texto || '';
  estoqueElementos.erro.hidden = !texto;
}

async function registrarMovimentacao(evento) {
  evento.preventDefault();

  const produto = estoqueDados.produtos.find(
    (item) => String(item.id) === estoqueElementos.produto.value
  );
  if (!produto) {
    return mostrarErro('Selecione um produto.');
  }

  const quantidade = Number(estoqueElementos.quantidade.value);
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    return mostrarErro('Informe uma quantidade maior que zero.');
  }

  const entrada = estoqueElementos.tipo.value === 'ENTRADA';
  const destinatario = estoqueElementos.destinatario.value.trim();
  const destino = estoqueElementos.destino.value.trim();
  if (!entrada && !destinatario) {
    return mostrarErro('Informe o destinatário.');
  }
  if (!entrada && !destino) {
    return mostrarErro('Informe o destino.');
  }

  const possuiValidade = Boolean(produto.possuiValidade);
  const dataValidade =
    entrada && possuiValidade ? estoqueElementos.validade.value || null : null;
  const localizacaoId = entrada
    ? Number(estoqueElementos.localizacao.value) || null
    : null;

  const payload = {
    tipo: entrada ? 'ENTRADA' : 'SAIDA',
    produtoId: Number(produto.id),
    quantidade,
    numeroLote: entrada ? estoqueElementos.lote.value.trim() || null : null,
    documento: null,
    dataValidade,
    localizacaoId,
    destinatario: entrada ? null : destinatario,
    destino: entrada ? null : destino,
    motivo: estoqueElementos.motivo.value,
    observacao: estoqueElementos.observacao.value.trim() || null,
  };

  estoqueElementos.enviar.disabled = true;
  estoqueElementos.enviar.textContent = 'Registrando...';
  mostrarErro('');

  try {
    await requisitarAPI('/movimentacoes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    fecharModal();
    await carregarEstoque();
    mostrarToast('Movimentação registrada no estoque real.', 'success');
  } catch (erroMovimentacao) {
    mostrarErro(erroMovimentacao.message || 'Não foi possível registrar a movimentação.');
  } finally {
    estoqueElementos.enviar.disabled = false;
    estoqueElementos.enviar.textContent =
      entrada ? 'Registrar entrada' : 'Registrar saída';
  }
}

async function carregarEstoque() {
  window.BabycareCore.tornarBreadcrumbClicavel();
  window.BabycareCore.adicionarBotaoVoltar('.estoque-action-group', 'Voltar ao dashboard');

  // Restaura filtros persistidos.
  const persistidos = carregarFiltrosCore('estoque');
  if (persistidos.busca !== undefined) estoqueElementos.busca.value = persistidos.busca;
  if (persistidos.categoriaId !== undefined) estoqueElementos.categoria.value = persistidos.categoriaId;
  if (persistidos.status !== undefined) estoqueElementos.status.value = persistidos.status;
  if (persistidos.ordenacao !== undefined) estoqueElementos.ordenacao.value = persistidos.ordenacao;

  mostrarCarregamento('Consultando estoque no banco...');
  try {
    const dados = await requisitarAPI('');
    estoqueDados.resumo = dados.resumo || {};
    estoqueDados.categorias = Array.isArray(dados.categorias) ? dados.categorias : [];
    estoqueDados.produtos = Array.isArray(dados.produtos) ? dados.produtos : [];
    estoqueDados.movimentacoes = Array.isArray(dados.movimentacoes) ? dados.movimentacoes : [];
    estoqueDados.localizacoes = Array.isArray(dados.localizacoes) ? dados.localizacoes : [];

    preencherCategorias(estoqueDados.categorias);
    preencherLocalizacoes(estoqueDados.localizacoes);
    definirMetricas();
    renderizarTabela();

    const movimentacoesRecentes = estoqueDados.movimentacoes.slice(0, 5);
    estoqueElementos.movimentacoesVazias.hidden = movimentacoesRecentes.length > 0;
    estoqueElementos.corpoMovimentacoes.replaceChildren(
      ...movimentacoesRecentes.map(criarLinhaMovimentacao)
    );

    estoqueElementos.alerta.hidden = true;
  } catch (erro) {
    definirMetricas();
    estoqueDados = {
      resumo: null,
      categorias: [],
      produtos: [],
      movimentacoes: [],
      localizacoes: [],
    };
    estoqueElementos.corpoTabela.replaceChildren();
    estoqueElementos.corpoMovimentacoes.replaceChildren();
    estoqueElementos.tabelaVazia.hidden = false;
    estoqueElementos.movimentacoesVazias.hidden = false;
    estoqueElementos.quantidadeResultados.textContent = 'Nenhum resultado';
    estoqueElementos.alerta.hidden = false;
    estoqueElementos.alertaTexto.textContent =
      erro.message || 'Não foi possível carregar os dados reais do estoque.';
    mostrarToast(erro.message || 'Não foi possível carregar o estoque.', 'error');
  } finally {
    esconderCarregamento();
  }
}

function configurarEventos() {
  [
    estoqueElementos.busca,
    estoqueElementos.categoria,
    estoqueElementos.status,
    estoqueElementos.ordenacao,
  ].forEach((elemento) => {
    elemento.addEventListener('input', () => {
      salvarFiltrosCore('estoque', {
        busca: estoqueElementos.busca.value,
        categoriaId: estoqueElementos.categoria.value,
        status: estoqueElementos.status.value,
        ordenacao: estoqueElementos.ordenacao.value,
      });
      renderizarTabela();
    });
  });

  estoqueElementos.abrirSidebar?.addEventListener('click', () =>
    document.body.classList.add('sidebar-open')
  );
  estoqueElementos.fecharSidebar?.addEventListener('click', () =>
    document.body.classList.remove('sidebar-open')
  );
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });

  conectarBuscaTopbar(estoqueElementos.busca);

  estoqueElementos.sidebarBusca?.addEventListener('input', () => {
    const termo = String(estoqueElementos.sidebarBusca?.value || '')
      .trim()
      .toLocaleLowerCase('pt-BR');
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
  estoqueElementos.verHistorico.addEventListener('click', () =>
    document
      .querySelector('.movimentacoes-panel')
      .scrollIntoView({ behavior: 'smooth', block: 'start' })
  );

  estoqueElementos.modal.addEventListener('click', (evento) => {
    if (evento.target === estoqueElementos.modal) {
      fecharModal();
    }
  });

  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !estoqueElementos.modal.hidden) {
      fecharModal();
    }
  });

  estoqueElementos.logout.addEventListener('click', fazerLogoutCore);
}

async function inicializarEstoque() {
  configurarUsuario();
  configurarEventos();
  await carregarEstoque();
}

window.addEventListener('load', inicializarEstoque);

