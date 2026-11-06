const PRODUTOS_API_URL = window.BabycareUI?.API_URL || window.location.origin;
const {
  salvarFiltros: salvarFiltrosCore,
  carregarFiltros: carregarFiltrosCore,
} = window.BabycareCore;

const productElements = {
  body: document.querySelector('#productsBody'),
  empty: document.querySelector('#productsEmpty'),
  search: document.querySelector('#productSearch'),
  category: document.querySelector('#categoryFilter'),
  status: document.querySelector('#statusFilter'),
  stock: document.querySelector('#stockFilter'),
  count: document.querySelector('#productResultCount'),
  total: document.querySelector('#totalProducts'),
  active: document.querySelector('#activeProducts'),
  low: document.querySelector('#lowProducts'),
  emptyStock: document.querySelector('#emptyProducts'),
  menuSearch: document.querySelector('#sidebarSearch'),
  topbarSearch: document.querySelector('#topbarSearch'),
  openSidebar: document.querySelector('#openSidebarButton'),
  closeSidebar: document.querySelector('#closeSidebarButton'),
  logout: document.querySelector('#logoutButton'),
};

let produtos = [];
let categorias = [];
let paginaAtual = 1;
const LIMITE_POR_PAGINA = 20;

const paginacaoElementos = {
  anterior: document.querySelector('#prodPaginaAnterior'),
  proxima: document.querySelector('#prodPaginaProxima'),
  atual: document.querySelector('#prodPaginaAtual'),
  total: document.querySelector('#prodPaginaTotal'),
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
  localStorage.removeItem('babycareUsuario');
  sessionStorage.removeItem('babycareUsuario');
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
  const resposta = await fetch(`${PRODUTOS_API_URL}${caminho}`, {
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
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!resposta.ok) {
    throw new Error(corpo.mensagem || 'Não foi possível consultar os produtos.');
  }

  return corpo;
}

function estadoEstoque(produto) {
  const estoque = Number(produto.estoque || 0);
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
      ATIVO: 'active',
      INATIVO: 'inactive',
      NORMAL: 'normal',
      BAIXO: 'low',
      SEM_ESTOQUE: 'empty',
    }[estado] || 'normal'
  );
}

function textoStatus(estado) {
  return (
    {
      ATIVO: 'Ativo',
      INATIVO: 'Inativo',
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

function criarCelulaSKU(sku) {
  const celula = document.createElement('td');
  celula.className = 'sku-cell';
  celula.textContent = sku ?? '—';
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'copy-button';
  botao.title = 'Copiar SKU';
  botao.setAttribute('aria-label', 'Copiar SKU');
  botao.textContent = '📋';
  botao.addEventListener('click', async () => {
    const ok = await window.BabycareCore.copiarParaAreaDeTransferencia(sku);
    const textoOriginal = botao.textContent;
    botao.textContent = ok ? '✓' : '✗';
    setTimeout(() => {
      botao.textContent = textoOriginal;
    }, 1200);
  });
  celula.appendChild(botao);
  return celula;
}

function criarBadge(estado, classeBase) {
  const badge = document.createElement('span');
  badge.className = `${classeBase} ${classeStatus(estado)}`;
  badge.textContent = textoStatus(estado);
  return badge;
}

function criarLinha(produto) {
  const linha = document.createElement('tr');
  const produtoCell = document.createElement('td');
  const produtoMain = document.createElement('div');
  const avatar = document.createElement('span');
  const produtoText = document.createElement('div');
  const produtoNome = document.createElement('span');
  const descricao = document.createElement('small');
  const estoqueCell = document.createElement('td');
  const estoque = document.createElement('span');
  const minimo = document.createElement('small');
  const statusCell = document.createElement('td');
  const acoesCell = document.createElement('td');
  const visualizar = document.createElement('button');

  avatar.className = 'product-avatar';
  avatar.textContent = produto.nome.charAt(0).toUpperCase();
  produtoMain.className = 'product-main-cell';
  produtoText.className = 'product-text';
  produtoNome.className = 'product-name';
  produtoNome.textContent = produto.nome;
  descricao.className = 'product-description';
  descricao.textContent = produto.descricao || 'Sem descrição cadastrada';
  produtoText.append(produtoNome, descricao);
  produtoMain.append(avatar, produtoText);
  produtoCell.appendChild(produtoMain);

  estoque.className = 'stock-value';
  estoque.textContent = window.BabycareUI.formatarNumero(produto.estoque);
  minimo.className = 'stock-minimum';
  minimo.textContent = `mín. ${window.BabycareUI.formatarNumero(produto.estoqueMinimo)}`;
  estoqueCell.append(estoque, minimo);

  statusCell.appendChild(criarBadge(produto.statusProduto || 'ATIVO', 'table-status'));
  linha.append(
    produtoCell,
    criarCelulaSKU(produto.sku),
    criarCelula(produto.categoria),
    estoqueCell,
    statusCell,
    criarCelula(window.BabycareUI.formatarData(produto.atualizadoEm))
  );

  visualizar.className = 'table-action';
  visualizar.type = 'button';
  visualizar.title = `Visualizar ${produto.nome}`;
  visualizar.setAttribute('aria-label', `Visualizar ${produto.nome}`);
  visualizar.textContent = '⋮';
  visualizar.addEventListener('click', () => {
    window.BabycareUI.mostrarToast(
      `Detalhes de ${produto.nome} serão desenvolvidos na próxima etapa.`
    );
  });
  acoesCell.appendChild(visualizar);
  linha.appendChild(acoesCell);

  return linha;
}

function produtoPassaFiltros(produto) {
  const termo = productElements.search.value.trim().toLowerCase();
  const categoriaId = productElements.category.value;
  const status = productElements.status.value;
  const estoqueFiltro = productElements.stock.value;
  const estado = estadoEstoque(produto);
  const textoPesquisavel = `${produto.nome} ${produto.sku} ${produto.categoria}`.toLowerCase();

  return (
    (!termo || textoPesquisavel.includes(termo)) &&
    (!categoriaId || String(produto.categoriaId) === categoriaId) &&
    (status === 'TODOS' || !status || produto.statusProduto === status) &&
    (!estoqueFiltro || estado === estoqueFiltro)
  );
}

function atualizarResumo() {
  productElements.total.textContent = window.BabycareUI.formatarNumero(produtos.length);
  productElements.active.textContent = window.BabycareUI.formatarNumero(
    produtos.filter((produto) => produto.statusProduto === 'ATIVO').length
  );
  productElements.low.textContent = window.BabycareUI.formatarNumero(
    produtos.filter((produto) => estadoEstoque(produto) === 'BAIXO').length
  );
  productElements.emptyStock.textContent = window.BabycareUI.formatarNumero(
    produtos.filter((produto) => estadoEstoque(produto) === 'SEM_ESTOQUE').length
  );
}

function renderizarProdutos() {
  const filtrados = produtos.filter(produtoPassaFiltros);
  productElements.body.replaceChildren(...filtrados.map(criarLinha));
  productElements.empty.hidden = filtrados.length > 0;
  productElements.count.textContent = `${window.BabycareUI.formatarNumero(filtrados.length)} ${filtrados.length === 1 ? 'produto' : 'produtos'}`;
}

function preencherCategorias() {
  productElements.category.replaceChildren(new Option('Todas', ''));
  categorias.forEach((categoria) => {
    productElements.category.appendChild(new Option(categoria.nome, categoria.id));
  });
}

function mostrarErro(erro) {
  productElements.body.replaceChildren();
  productElements.empty.hidden = false;
  productElements.empty.textContent =
    erro.message || 'Não foi possível carregar os produtos reais.';
  productElements.count.textContent = 'Nenhum resultado';
  atualizarResumo();
  window.BabycareUI.mostrarToast(erro.message || 'Não foi possível carregar os produtos.', 'error');
}

async function carregarProdutos() {
  // Restaura filtros persistidos antes de carregar.
  const persistidos = carregarFiltrosCore('produtos');
  if (persistidos.busca !== undefined) productElements.search.value = persistidos.busca;
  if (persistidos.categoriaId !== undefined) productElements.category.value = persistidos.categoriaId;
  if (persistidos.status !== undefined) productElements.status.value = persistidos.status;
  if (persistidos.stock !== undefined) productElements.stock.value = persistidos.stock;
  if (persistidos.pagina !== undefined) paginaAtual = Math.max(1, Number(persistidos.pagina) || 1);

  window.BabycareUI.mostrarCarregamento('Consultando produtos no banco...');
  try {
    const [categoriasResposta, produtosResposta] = await Promise.all([
      requisitarAPI('/api/produtos/categorias'),
      requisitarAPI(
        `/api/produtos?pagina=${paginaAtual}&limite=${LIMITE_POR_PAGINA}`
      ),
    ]);
    categorias = Array.isArray(categoriasResposta.categorias) ? categoriasResposta.categorias : [];
    const dadosProdutos = Array.isArray(produtosResposta.dados) ? produtosResposta.dados : [];
    produtos = dadosProdutos;
    preencherCategorias();
    atualizarResumo();
    renderizarProdutos();
    renderizarPaginacao(produtosResposta.totalPaginas || 1, produtosResposta.pagina || 1);
  } catch (erro) {
    produtos = [];
    mostrarErro(erro);
  } finally {
    window.BabycareUI.esconderCarregamento();
  }
}

function renderizarPaginacao(totalPaginas, pagina) {
  paginaAtual = Math.max(1, Math.min(totalPaginas, pagina));
  if (paginacaoElementos.atual) paginacaoElementos.atual.textContent = paginaAtual;
  if (paginacaoElementos.total) paginacaoElementos.total.textContent = totalPaginas;
  if (paginacaoElementos.anterior)
    paginacaoElementos.anterior.disabled = paginaAtual <= 1;
  if (paginacaoElementos.proxima)
    paginacaoElementos.proxima.disabled = paginaAtual >= totalPaginas || totalPaginas === 0;
}

function configurarEventos() {
  [
    productElements.search,
    productElements.category,
    productElements.status,
    productElements.stock,
  ].forEach((elemento) => {
    elemento.addEventListener('input', () => {
      salvarFiltrosCore('produtos', {
        busca: productElements.search.value,
        categoriaId: productElements.category.value,
        status: productElements.status.value,
        stock: productElements.stock.value,
      });
      renderizarProdutos();
    });
  });

  paginacaoElementos.anterior?.addEventListener('click', () => {
    if (paginaAtual > 1) {
      paginaAtual -= 1;
      salvarFiltrosCore('produtos', { pagina: paginaAtual });
      carregarProdutos();
    }
  });

  paginacaoElementos.proxima?.addEventListener('click', () => {
    paginaAtual += 1;
    salvarFiltrosCore('produtos', { pagina: paginaAtual });
    carregarProdutos();
  });

  productElements.openSidebar?.addEventListener('click', () => {
    document.body.classList.add('sidebar-open');
  });

  productElements.closeSidebar?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });

  document.getElementById('prodExportarCsv')?.addEventListener('click', () => {
    if (!produtos.length) {
      window.BabycareUI.mostrarToast('Nenhum produto para exportar.');
      return;
    }
    window.BabycareUI.exportarCSV(
      produtos.map((p) => ({
        SKU: p.sku,
        Nome: p.nome,
        Categoria: p.categoria,
        Estoque: p.estoque,
        Mínimo: p.estoqueMinimo,
        Status: p.statusProduto,
        Atualizado: p.atualizadoEm,
      })),
      ['SKU', 'Nome', 'Categoria', 'Estoque', 'Mínimo', 'Status', 'Atualizado'],
      'produtos.csv'
    );
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });

  window.BabycareUI.conectarBuscaTopbar(productElements.search);

  window.BabycareCore.tornarBreadcrumbClicavel();
  window.BabycareCore.adicionarBotaoVoltar('.products-toolbar', 'Voltar ao dashboard');

  productElements.logout.addEventListener('click', () => {
    if (window.BabycareUI?.fazerLogout) {
      window.BabycareUI.fazerLogout();
    } else {
      limparSessao();
      window.BabycareUI.transicionarPara('./login.html');
    }
  });

  document.querySelectorAll('[data-coming-soon]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      evento.preventDefault();
      window.BabycareUI.mostrarToast(
        `O módulo ${link.dataset.comingSoon} será desenvolvido na próxima etapa.`
      );
    });
  });

  productElements.menuSearch.addEventListener('input', () => {
    const termo = productElements.menuSearch.value.trim().toLowerCase();
    document.querySelectorAll('.main-nav .nav-link').forEach((item) => {
      item.hidden = termo.length > 0 && !item.textContent.toLowerCase().includes(termo);
    });
  });
}

async function inicializarProdutos() {
  configurarUsuario();
  configurarEventos();
  await carregarProdutos();
}

window.addEventListener('load', inicializarProdutos);
