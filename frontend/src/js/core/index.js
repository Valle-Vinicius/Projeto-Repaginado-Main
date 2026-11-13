import './vlibras.js';
import { formatarData } from './date-formatters.js';
import { fetchAPI } from './api.js';
import { montarSidebar } from './sidebar.js';
import { configurarTabelasResponsivas } from './responsive-tables.js';

export { formatarData };

const CHAVES_USUARIO = ['babycareUsuario', 'babycareUser'];

/** Lê o usuário logado do localStorage ou sessionStorage. */
export function lerUsuario() {
  const ler = (storage) => {
    const raw = storage.getItem(CHAVES_USUARIO[0]) || storage.getItem(CHAVES_USUARIO[1]);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };
  return ler(sessionStorage) || ler(localStorage) || {};
}

/** Escapa HTML para evitar XSS ao injetar texto no DOM. */
export function esc(valor) {
  const d = document.createElement('div');
  d.textContent = valor ?? '';
  return d.innerHTML.replace(/"/g, '&quot;');
}

/** Formata data e hora pt-BR (ex.: 01/01/2026 14:30). */
export function formatarDataHora(valor) {
  if (!valor) {
    return '—';
  }
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) {
    return String(valor);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/** Retorna as iniciais de um nome (ex.: "João Silva" → "JS"). */
export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/u).filter(Boolean);
  if (partes.length === 0) {
    return 'U';
  }
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

/** Formata o nome do perfil para exibição. */
export function perfilExibicao(perfil) {
  return String(perfil || 'Perfil de acesso')
    .replace(/_/gu, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\S/gu, (letra) => letra.toLocaleUpperCase('pt-BR'));
}

/** Limpa todos os dados de sessão do localStorage e sessionStorage. */
export function limparSessao() {
  CHAVES_USUARIO.forEach((chave) => {
    localStorage.removeItem(chave);
    sessionStorage.removeItem(chave);
  });
}

/** Requisição HTTP genérica com JSON e credenciais (cookie). */
export async function requisitar(url, opcoes = {}) {
  const resposta = await fetchAPI(url, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(opcoes.headers || {}),
    },
    credentials: 'include',
  });

  let corpo = {};
  try {
    corpo = await resposta.json();
  } catch {
    // corpo não-JSON
  }

  if (!resposta.ok) {
    const erro = new Error(corpo.mensagem || 'Não foi possível concluir a operação.');
    erro.status = resposta.status;
    throw erro;
  }

  return corpo;
}

/** Salva filtros/preferências de uma página no localStorage. */
export function salvarFiltros(chave, dados) {
  try {
    const atual = JSON.parse(localStorage.getItem(`babycare:filtros:${chave}`) || '{}');
    localStorage.setItem(
      `babycare:filtros:${chave}`,
      JSON.stringify({ ...atual, ...dados })
    );
  } catch {
    // falha silenciosa: persistência é opcional
  }
}

/** Carrega filtros/preferências de uma página do localStorage. */
export function carregarFiltros(chave) {
  try {
    const bruto = localStorage.getItem(`babycare:filtros:${chave}`);
    return bruto ? JSON.parse(bruto) : {};
  } catch {
    return {};
  }
}

/** Cria um elemento de estado vazio padrão com mensagem e ação opcional. */
export function criarEstadoVazio(mensagem, acaoLabel, acaoCallback) {
  const container = document.createElement('div');
  container.className = 'estado-vazio';
  container.setAttribute('role', 'status');
  container.setAttribute('aria-live', 'polite');

  const texto = document.createElement('p');
  texto.textContent = mensagem;
  container.appendChild(texto);

  if (acaoLabel && acaoCallback) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'primary-button';
    botao.textContent = acaoLabel;
    botao.addEventListener('click', acaoCallback);
    container.appendChild(botao);
  }

  return container;
}

/** Configura atalhos de teclado globais sem interferir em inputs. */
export function configurarAtalhos(opcoes = {}) {
  const { onBuscaGlobal, onFecharModal, onSubmitForm } = opcoes;

  document.addEventListener('keydown', (evento) => {
    const alvo = evento.target;
    const editavel =
      alvo.tagName === 'INPUT' ||
      alvo.tagName === 'TEXTAREA' ||
      alvo.tagName === 'SELECT' ||
      alvo.isContentEditable;
    if (editavel) return;

    if (evento.ctrlKey && evento.key.toLowerCase() === 'k') {
      evento.preventDefault();
      if (onBuscaGlobal) {
        onBuscaGlobal();
        return;
      }
      const buscaSidebar = document.querySelector('#sidebarSearch');
      if (buscaSidebar) {
        buscaSidebar.focus();
      }
    }

    if (evento.key === 'Escape') {
      if (onFecharModal) {
        onFecharModal();
        return;
      }
      const modalAberto = document.querySelector('[role="dialog"]:not([hidden])');
      if (modalAberto) {
        const btnFechar = modalAberto.querySelector(
          '[aria-label*="Fechar"], [aria-label*="fechar"], .modal-close, .close-button'
        );
        if (btnFechar) btnFechar.click();
      }
    }

    if (evento.ctrlKey && evento.key === 'Enter') {
      if (onSubmitForm) {
        onSubmitForm();
        return;
      }
      const formAtivo = document.querySelector('form:not([novalidate])');
      if (formAtivo && !formAtivo.querySelector('button[type="submit"]:disabled')) {
        const btnSubmit = formAtivo.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.click();
      }
    }
  });
}

/** Adiciona um botão "Voltar" simples que usa o histórico do navegador. */
export function adicionarBotaoVoltar(containerSeletor, label = 'Voltar') {
  const container = document.querySelector(containerSeletor);
  if (!container) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'voltar-button';
  btn.textContent = label;
  btn.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = './dashboard.html';
    }
  });
  container.prepend(btn);
}

/** Copia um texto para a área de transferência com fallback. */
export async function copiarParaAreaDeTransferencia(texto) {
  const valor = String(texto ?? '');
  try {
    await navigator.clipboard.writeText(valor);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = valor;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
    } catch {
      // falha silenciosa
    }
    document.body.removeChild(area);
    return false;
  }
}

/** Adiciona contador de caracteres a todos os campos com maxlength na página. */
export function adicionarContadorCaracteres() {
  document.querySelectorAll('textarea[maxlength], input[maxlength]').forEach((campo) => {
    if (campo.dataset.contadorAdicionado) return;
    const limite = campo.getAttribute('maxlength');
    const contador = document.createElement('small');
    contador.className = 'contador-caracteres';
    contador.textContent = `${campo.value.length}/${limite}`;
    campo.parentNode?.appendChild(contador);
    campo.dataset.contadorAdicionado = '1';
    campo.addEventListener('input', () => {
      contador.textContent = `${campo.value.length}/${limite}`;
      if (campo.value.length > Number(limite) * 0.9) {
        contador.style.color = '#d32f2f';
      } else {
        contador.style.color = '';
      }
    });
  });
}

/** Torna o item "Babycare" do breadcrumb um link para o dashboard. */
export function tornarBreadcrumbClicavel() {
  const breadcrumb = document.querySelector('.breadcrumb, .topbar-left p');
  if (!breadcrumb) return;
  const primeiroLink = breadcrumb.querySelector('a');
  if (primeiroLink) return;
  const primeiroTexto = breadcrumb.childNodes[0];
  if (primeiroTexto && primeiroTexto.textContent?.trim() === 'Babycare') {
    const link = document.createElement('a');
    link.href = './dashboard.html';
    link.textContent = 'Babycare';
    link.style.cursor = 'pointer';
    link.style.textDecoration = 'underline';
    primeiroTexto.replaceWith(link);
  }
}

/** Expõe o core no window para compatibilidade com páginas que ainda usam globals. */
window.BabycareCore = {
  lerUsuario,
  esc,
  formatarData,
  formatarDataHora,
  iniciais,
  perfilExibicao,
  limparSessao,
  requisitar,
  salvarFiltros,
  carregarFiltros,
  criarEstadoVazio,
  configurarAtalhos,
  adicionarBotaoVoltar,
  copiarParaAreaDeTransferencia,
  adicionarContadorCaracteres,
  tornarBreadcrumbClicavel,
  CHAVES_USUARIO,
};

if (document.querySelector('#sidebar')) {
  montarSidebar();
}

configurarTabelasResponsivas();
