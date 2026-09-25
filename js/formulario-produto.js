const API_URL = window.BabycareUI?.API_URL || window.location.origin;

const form = document.querySelector('#productForm');
const validityField = document.querySelector('#validityField');
const validityDate = document.querySelector('#dataValidade');
const description = document.querySelector('#descricao');
const descriptionCount = document.querySelector('#descriptionCount');
const formMessage = document.querySelector('#productFormMessage');
const submitButton = form.querySelector('button[type="submit"]');
const categorySelect = document.querySelector('#categoria');
const sidebarSearch = document.querySelector('#sidebarSearch');
const topbarSearch = document.querySelector('#topbarSearch');
const notificationButton = document.querySelector('#notificationButton');
const openSidebarButton = document.querySelector('#openSidebarButton');
const closeSidebarButton = document.querySelector('#closeSidebarButton');

function obterToken() {
  return localStorage.getItem('babycareToken') || sessionStorage.getItem('babycareToken');
}

function obterUsuarioDoFormulario() {
  const salvo = localStorage.getItem('babycareUsuario') || sessionStorage.getItem('babycareUsuario');
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

function preencherUsuarioDoLayout() {
  const usuario = obterUsuarioDoFormulario();
  const nome = usuario?.nome || 'Usuário Babycare';
  const perfil = (usuario?.perfil || 'OPERADOR_ESTOQUE')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
  const iniciais = nome.split(' ').filter(Boolean).slice(0, 2).map((parte) => parte[0].toUpperCase()).join('') || 'U';

  document.querySelector('#sidebarUserName').textContent = nome;
  document.querySelector('#sidebarUserRole').textContent = perfil;
  document.querySelector('#topbarUserName').textContent = nome;
  document.querySelector('#topbarUserRole').textContent = perfil;
  document.querySelector('#sidebarAvatar').textContent = iniciais;
  document.querySelector('#topbarAvatar').textContent = iniciais;
}

function limparErros() {
  form.querySelectorAll('.invalid').forEach((input) => input.classList.remove('invalid'));
  form.querySelectorAll('.field-error').forEach((error) => {
    error.textContent = '';
  });
  formMessage.textContent = '';
  formMessage.className = 'form-message';
}

function definirErro(campo, mensagem) {
  const input = form.querySelector(`#${campo}`);
  const error = form.querySelector(`[data-error-for="${campo}"]`);
  input?.classList.add('invalid');
  if (error) error.textContent = mensagem;
}

function hojeComoTexto() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}

function atualizarCampoValidade() {
  const selecionado = form.querySelector('input[name="possuiValidade"]:checked')?.value === 'sim';
  validityDate.disabled = !selecionado;
  validityDate.required = selecionado;
  validityField.classList.toggle('is-disabled', !selecionado);

  if (!selecionado) {
    validityDate.value = '';
    validityDate.classList.remove('invalid');
    form.querySelector('[data-error-for="dataValidade"]').textContent = '';
  }
}

function validarFormularioProduto() {
  limparErros();
  let valido = true;
  const nome = document.querySelector('#nome').value.trim();
  const sku = document.querySelector('#sku').value.trim();
  const categoria = document.querySelector('#categoria').value;
  const estoqueMinimo = document.querySelector('#estoqueMinimo').value;
  const unidade = document.querySelector('#unidade').value;
  const possuiValidade = form.querySelector('input[name="possuiValidade"]:checked')?.value === 'sim';

  if (nome.length < 3) {
    definirErro('nome', 'Informe um nome com pelo menos 3 caracteres.');
    valido = false;
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,49}$/.test(sku)) {
    definirErro('sku', 'Use de 3 a 50 caracteres: letras, números, hífen ou sublinhado.');
    valido = false;
  }

  if (!categoria) {
    definirErro('categoria', 'Selecione uma categoria.');
    valido = false;
  }

  if (estoqueMinimo === '' || Number(estoqueMinimo) < 0 || !Number.isFinite(Number(estoqueMinimo))) {
    definirErro('estoqueMinimo', 'Informe um número maior ou igual a zero.');
    valido = false;
  }

  if (!unidade) {
    definirErro('unidade', 'Selecione uma unidade de medida.');
    valido = false;
  }

  if (possuiValidade && (!validityDate.value || validityDate.value < hojeComoTexto())) {
    definirErro('dataValidade', 'Informe uma data de validade igual ou posterior a hoje.');
    valido = false;
  }

  return valido;
}

async function requisitarAPI(caminho, opcoes = {}) {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${obterToken()}`,
      ...(opcoes.headers || {})
    }
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (resposta.status === 401) {
    limparSessao();
    window.location.replace('./login.html');
    throw new Error('Sessão expirada. Faça login novamente.');
  }

  if (!resposta.ok) {
    throw new Error(corpo.mensagem || 'Não foi possível concluir o cadastro.');
  }

  return corpo;
}

async function carregarCategorias() {
  const resposta = await requisitarAPI('/api/produtos/categorias');
  const categorias = Array.isArray(resposta.categorias) ? resposta.categorias : [];
  categorySelect.replaceChildren(new Option('Selecione uma categoria', ''));
  categorias.forEach((categoria) => {
    categorySelect.appendChild(new Option(categoria.nome, categoria.id));
  });
}

function configurarNavegacao() {
  openSidebarButton?.addEventListener('click', () => {
    document.body.classList.add('sidebar-open');
  });

  closeSidebarButton?.addEventListener('click', () => {
    document.body.classList.remove('sidebar-open');
  });

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  });

  notificationButton?.addEventListener('click', () => {
    window.BabycareUI.mostrarToast('Você não possui novas notificações.');
  });

  topbarSearch?.addEventListener('search', () => {
    if (topbarSearch.value.trim()) {
      window.BabycareUI.mostrarToast('Use a busca lateral para localizar uma seção do painel.');
    }
  });

  sidebarSearch?.addEventListener('input', () => {
    const termo = sidebarSearch.value.trim().toLocaleLowerCase('pt-BR');
    document.querySelectorAll('.main-nav .nav-link').forEach((link) => {
      link.hidden = Boolean(termo) && !link.textContent.toLocaleLowerCase('pt-BR').includes(termo);
    });
  });

  document.querySelectorAll('[data-coming-soon]').forEach((link) => {
    link.addEventListener('click', (evento) => {
      evento.preventDefault();
      window.BabycareUI.mostrarToast(`O módulo ${link.dataset.comingSoon} será desenvolvido na próxima etapa.`);
    });
  });

  document.querySelector('#logoutButton').addEventListener('click', () => {
    limparSessao();
    window.BabycareUI.transicionarPara('./login.html');
  });
}

function montarPayload() {
  return {
    nome: document.querySelector('#nome').value.trim(),
    codigo: document.querySelector('#sku').value.trim().toUpperCase(),
    descricao: document.querySelector('#descricao').value.trim() || null,
    categoriaId: Number(document.querySelector('#categoria').value),
    estoqueMinimo: Number(document.querySelector('#estoqueMinimo').value),
    unidade: document.querySelector('#unidade').value,
    possuiValidade: form.querySelector('input[name="possuiValidade"]:checked')?.value === 'sim'
  };
}

description.addEventListener('input', () => {
  descriptionCount.textContent = String(description.value.length);
});

form.querySelectorAll('input[name="possuiValidade"]').forEach((radio) => {
  radio.addEventListener('change', atualizarCampoValidade);
});

form.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  if (!validarFormularioProduto()) {
    form.querySelector('.invalid')?.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.classList.add('is-loading');
  formMessage.textContent = '';

  try {
    await requisitarAPI('/api/produtos', {
      method: 'POST',
      body: JSON.stringify(montarPayload())
    });

    formMessage.textContent = 'Produto cadastrado com sucesso no banco de dados.';
    formMessage.className = 'form-message success';
    window.setTimeout(() => window.BabycareUI.transicionarPara('./produtos.html'), 550);
  } catch (erro) {
    formMessage.textContent = erro.message || 'Não foi possível cadastrar o produto.';
    formMessage.className = 'form-message error';
    submitButton.disabled = false;
    submitButton.classList.remove('is-loading');
  }
});

window.addEventListener('load', async () => {
  if (!obterToken()) {
    window.location.replace('./login.html');
    return;
  }

  preencherUsuarioDoLayout();
  configurarNavegacao();
  atualizarCampoValidade();

  try {
    window.BabycareUI.mostrarCarregamento('Carregando categorias...');
    await carregarCategorias();
  } catch (erro) {
    formMessage.textContent = erro.message || 'Não foi possível carregar as categorias reais.';
    formMessage.className = 'form-message error';
  } finally {
    window.BabycareUI.esconderCarregamento();
  }
});
