import { API_URL } from '../../js/core/api.js';
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

function limparSessao() {
  localStorage.removeItem('babycareToken');
  localStorage.removeItem('babycareUsuario');
  sessionStorage.removeItem('babycareToken');
  sessionStorage.removeItem('babycareUsuario');
}

function configurarUsuario() {
  const usuario = obterUsuario();
  const nome = usuario?.nome || 'UsuÃ¡rio Babycare';
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
  const resposta = await fetch(`${ESTOQUE_API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
    credentials: 'include',
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) {
    limparSessao();
    window.location.replace('./login.html');
    throw new Error('SessÃ£o expirada. FaÃ§a login novamente.');
  }

  if (!resposta.ok) {
    throw new Error(corpo.mensagem || 'NÃ£o foi possÃ­vel consultar o estoque.');
  }

  return corpo;
}

function definirMetricas() {
  const resumo = estoqueDados.resumo || {};
  estoqueElementos.total.textContent = formatarNumero(resumo.totalEmEstoque ?? 0);
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
  if (estoque < minimo) {
    return 'BAIXO';
  }
  return 'NORMAL';
}

function classeStatus(estado) {
  return (
    {
      NORMAL: 'normal',
      BAIXO: 'low',
      SEM_ESTOQUE: 'empty',
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
  celula.textContent = texto ?? 'â€”';
  return celula;
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

  estoqueElementos.corpoTabela.replaceChildren();
  estoqueElementos.tabelaVazia.hidden = filtrados.length > 0;
  estoqueElementos.quantidadeResultados.textContent = `${filtrados.length} resultado(s)`;

  filtrados.forEach((produto) => {
    const linha = document.createElement('tr');
    const estado = estadoEstoque(produto);
    linha.innerHTML = `
      <td><strong>${produto.nome}</strong><small>${produto.codigo}</small></td>
      <td>${produto.categoria}</td>
      <td class="estoque-valor">${formatarNumero(produto.estoqueAtual)}</td>
      <td>${formatarNumero(produto.estoqueMinimo)}</td>
      <td><span class="status-${classeStatus(estado)}">${textoStatus(estado)}</span></td>
      <td>${produto.ultimaMovimentacao ? formatarDataHora(produto.ultimaMovimentacao) : 'â€”'}</td>
      <td></td>
    `;
    estoqueElementos.corpoTabela.appendChild(linha);
  });
}

function preencherCategorias(categorias) {
  estoqueElementos.categoria.replaceChildren(new Option('Todas', ''));
  categorias.forEach((categoria) => {
    estoqueElementos.categoria.appendChild(new Option(categoria.nome, categoria.id));
  });
}

function preencherLocalizacoes(localizacoes) {
  estoqueElementos.localizacao.replaceChildren(new Option('Selecione uma localizaÃ§Ã£o', ''));
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
      new Option(`${produto.nome} â€” ${produto.codigo}`, produto.id)
    );
  });
}

function preencherMotivos(tipo) {
  const motivos =
    tipo === 'ENTRADA'
      ? [
          ['RECEBIMENTO', 'Recebimento de fornecedor'],
          ['DEVOLUCAO', 'DevoluÃ§Ã£o'],
          ['AJUSTE', 'Ajuste de estoque'],
          ['OUTRO', 'Outro motivo'],
        ]
      : [
          ['EXPEDICAO', 'ExpediÃ§Ã£o'],
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
    return;
  }

  estoqueElementos.estoqueDisponivel.hidden = false;
  estoqueElementos.estoqueDisponivel.textContent = `Saldo disponÃ­vel: ${formatarNumero(produto.estoqueAtual)} ${produto.unidade || 'unidade(s)'}`;

  const exigeValidade = Boolean(produto.possuiValidade);
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
    tipo === 'ENTRADA' ? 'Registrar entrada' : 'Registrar saÃ­da';
  estoqueElementos.modalDescricao.textContent =
    tipo === 'ENTRADA'
      ? 'Registre a entrada no lote recebido para atualizar o saldo real.'
      : 'Registre a saÃ­da do produto para atualizar o saldo real.';
  estoqueElementos.formulario.reset();
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
  const possuiValidade = Boolean(produto.possuiValidade);
  const dataValidade = possuiValidade ? estoqueElementos.validade.value || null : null;
  const localizacaoId = Number(estoqueElementos.localizacao.value) || null;

  const payload = {
    tipo: entrada ? 'ENTRADA' : 'SAIDA',
    produtoId: Number(produto.id),
    quantidade,
    numeroLote: estoqueElementos.lote.value.trim() || null,
    fornecedor: entrada ? estoqueElementos.observacao.value.trim() || null : null,
    documento: null,
    dataValidade,
    localizacaoId,
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
    mostrarToast('MovimentaÃ§Ã£o registrada no estoque real.', 'success');
  } catch (erroMovimentacao) {
    mostrarErro(erroMovimentacao.message || 'NÃ£o foi possÃ­vel registrar a movimentaÃ§Ã£o.');
  } finally {
    estoqueElementos.enviar.disabled = false;
    estoqueElementos.enviar.textContent =
      tipo === 'ENTRADA' ? 'Registrar entrada' : 'Registrar saÃ­da';
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
    estoqueElementos.corpoMovimentacoes.replaceChildren();
    estoqueElementos.movimentacoesVazias.hidden = movimentacoesRecentes.length > 0;
    movimentacoesRecentes.forEach((mov) => {
      const linha = document.createElement('tr');
      linha.innerHTML = `
        <td>${formatarDataHora(mov.criadoEm)}</td>
        <td>${mov.produto}</td>
        <td>${mov.tipo}</td>
        <td>${formatarNumero(mov.quantidade)}</td>
        <td>${mov.responsavel}</td>
        <td>${mov.motivo}</td>
      `;
      estoqueElementos.corpoMovimentacoes.appendChild(linha);
    });

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
      erro.message || 'NÃ£o foi possÃ­vel carregar os dados reais do estoque.';
    mostrarToast(erro.message || 'NÃ£o foi possÃ­vel carregar o estoque.', 'error');
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

  estoqueElementos.logout.addEventListener('click', () => {
    if (window.BabycareUI?.fazerLogout) {
      window.BabycareUI.fazerLogout();
    } else {
      limparSessao();
      window.BabycareUI.transicionarPara('./login.html');
    }
  });
}

async function inicializarEstoque() {
  configurarUsuario();
  configurarEventos();
  await carregarEstoque();
}

window.addEventListener('load', inicializarEstoque);

