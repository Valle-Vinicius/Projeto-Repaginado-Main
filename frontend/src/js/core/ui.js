import { API_URL } from './api.js';

const UI_API_URL = API_URL;

export function esconderCarregamento() {
  const loader = document.querySelector('#pageLoader');
  if (!loader) {
    return;
  }
  window.requestAnimationFrame(() => {
    loader.classList.add('is-hidden');
    document.body.classList.add('page-ready');
  });
}

export function mostrarCarregamento(texto = 'Carregando...') {
  const loader = document.querySelector('#pageLoader');
  if (!loader) {
    return;
  }
  const label = loader.querySelector('.page-loader-label');
  if (label) {
    label.textContent = texto;
  }
  loader.classList.remove('is-hidden');
}

export function transicionarPara(url, duracao = 560) {
  document.body.classList.add('page-leaving');
  window.setTimeout(() => {
    window.location.href = url;
  }, duracao);
}

export async function fazerLogout() {
  try {
    await fetch(`${UI_API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (erro) {
    // Prossegue com a limpeza local mesmo se o servidor estiver inacessível
  } finally {
    ['babycareToken', 'babycareUsuario', 'babycareUser'].forEach((chave) => {
      localStorage.removeItem(chave);
      sessionStorage.removeItem(chave);
    });
    window.location.href = './login.html';
  }
}

export function mostrarToast(texto, tipo = '') {
  let toast = document.querySelector('#uiToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'uiToast';
    toast.className = 'ui-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  toast.textContent = texto;
  toast.className = `ui-toast ${tipo}`.trim();
  window.clearTimeout(mostrarToast.timer);
  window.requestAnimationFrame(() => toast.classList.add('show'));
  mostrarToast.timer = window.setTimeout(() => toast.classList.remove('show'), 3000);
}

export function aplicarMascara(valor, mascara) {
  const numeros = String(valor || '').replace(/\D/g, '');
  let indice = 0;
  return mascara.replace(/#/g, () => numeros[indice++] || '');
}
export function formatarCPF(valor) {
  return aplicarMascara(valor, '###.###.###-##');
}
export function formatarCNPJ(valor) {
  return aplicarMascara(valor, '##.###.###/####-##');
}
export function formatarTelefone(valor) {
  const numeros = String(valor || '')
    .replace(/\D/g, '')
    .slice(0, 11);
  return aplicarMascara(numeros, numeros.length <= 10 ? '(##) ####-####' : '(##) #####-####');
}
export function formatarCEP(valor) {
  return aplicarMascara(valor, '#####-###');
}
export function formatarMoeda(valor) {
  const numeros = String(valor || '').replace(/\D/g, '');
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(numeros || 0) / 100);
}
export function formatarNumero(valor, casas = 0) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(Number(valor || 0));
}
export function formatarData(valor) {
  if (!valor) {
    return '';
  }
  const data = String(valor).includes('T') ? new Date(valor) : new Date(`${valor}T00:00:00`);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
}
export function formatarDataHora(valor) {
  if (!valor) {
    return '';
  }
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleString('pt-BR');
}
export function limitarDataMinima(input) {
  if (!input || input.type !== 'date') {
    return;
  }
  const hoje = new Date();
  input.min = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
}
export function validarEmailFrontend(valor) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || '').trim());
}
export function configurarFormatacaoCampos(root = document) {
  root.querySelectorAll('[data-mask="cpf"]').forEach((input) =>
    input.addEventListener('input', () => {
      input.value = formatarCPF(input.value);
    })
  );
  root.querySelectorAll('[data-mask="cnpj"]').forEach((input) =>
    input.addEventListener('input', () => {
      input.value = formatarCNPJ(input.value);
    })
  );
  root.querySelectorAll('[data-mask="telefone"]').forEach((input) =>
    input.addEventListener('input', () => {
      input.value = formatarTelefone(input.value);
    })
  );
  root.querySelectorAll('[data-mask="cep"]').forEach((input) =>
    input.addEventListener('input', () => {
      input.value = formatarCEP(input.value);
    })
  );
  root.querySelectorAll('[data-format="moeda"]').forEach((input) =>
    input.addEventListener('input', () => {
      input.value = formatarMoeda(input.value);
    })
  );
  root.querySelectorAll('[data-format="numero"]').forEach((input) =>
    input.addEventListener('blur', () => {
      if (input.value !== '') {
        input.value = formatarNumero(input.value);
      }
    })
  );
  root.querySelectorAll('input[type="date"][data-date-min="today"]').forEach(limitarDataMinima);
}

export function lerUsuario() {
  const ler = (storage) => {
    const raw = storage.getItem('babycareUsuario') || storage.getItem('babycareUser');
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

export async function atualizarUsuario() {
  let u = lerUsuario();

  try {
    const resposta = await fetch(`${UI_API_URL}/perfil`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (resposta.ok) {
      const corpo = await resposta.json();
      if (corpo.usuario) {
        u = corpo.usuario;
        const armazenamento = localStorage.getItem('babycareUsuario')
          ? localStorage
          : sessionStorage;
        armazenamento.setItem('babycareUsuario', JSON.stringify(u));
      }
    }
  } catch (erro) {
    // Fallback para dados do storage se a API falhar
  }

  const nome = String(u.nome || 'Usuário Babycare');
  const perfil = String(
    u.perfil || u.perfilCodigo || u.cargo || u.cargoCodigo || u.role || 'Perfil de acesso'
  )
    .replace(/_/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)\S/g, (x) => x.toLocaleUpperCase('pt-BR'));
  const parts = nome.split(/\s+/).filter(Boolean);
  const iniciais = (
    parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : nome.slice(0, 2)
  ).toUpperCase();

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
      x.textContent = iniciais;
    }
  });
}

export function exportarCSV(dados, colunas, nomeArquivo = 'exportacao.csv') {
  if (!Array.isArray(dados) || dados.length === 0) {
    mostrarToast('Nenhum dado para exportar.');
    return;
  }

  const escapeCSV = (valor) => {
    const texto = String(valor ?? '');
    if (texto.includes(',') || texto.includes('"') || texto.includes('\n')) {
      return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
  };

  const header = colunas.map((c) => escapeCSV(c.label || c)).join(',');
  const rows = dados.map((item) =>
    colunas
      .map((c) => escapeCSV(typeof c.get === 'function' ? c.get(item) : item[c.key || c]))
      .join(',')
  );

  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  mostrarToast('Arquivo CSV exportado com sucesso.');
}

export function escapeHtml(texto) {
  const d = document.createElement('div');
  d.textContent = texto;
  return d.innerHTML;
}

export function confirmar(
  mensagem,
  titulo = 'Confirmar ação',
  botaoConfirmar = 'Confirmar',
  botaoCancelar = 'Cancelar'
) {
  return new Promise((resolve) => {
    let overlay = document.querySelector('#confirmOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirmOverlay';
      overlay.className = 'confirm-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="confirm-modal">
        <h3 class="confirm-title">${escapeHtml(titulo)}</h3>
        <p class="confirm-message">${escapeHtml(mensagem)}</p>
        <div class="confirm-actions">
          <button class="confirm-cancel" type="button">${escapeHtml(botaoCancelar)}</button>
          <button class="confirm-ok" type="button">${escapeHtml(botaoConfirmar)}</button>
        </div>
      </div>
    `;

    const btnOk = overlay.querySelector('.confirm-ok');
    const btnCancel = overlay.querySelector('.confirm-cancel');

    const fechar = (resultado) => {
      overlay.classList.remove('aberto');
      btnOk.removeEventListener('click', onOk);
      btnCancel.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(resultado);
    };

    const onOk = () => fechar(true);
    const onCancel = () => fechar(false);
    const onOverlay = (e) => {
      if (e.target === overlay) {
        fechar(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        fechar(false);
      }
    };

    btnOk.addEventListener('click', onOk);
    btnCancel.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);

    overlay.classList.add('aberto');
    btnOk.focus();
  });
}

export function conectarBuscaTopbar(campoBuscaPagina) {
  const topbarBusca = document.querySelector('#topbarSearch');
  if (!topbarBusca || !campoBuscaPagina) {
    return;
  }

  topbarBusca.addEventListener('search', () => {
    const termo = topbarBusca.value.trim();
    if (termo) {
      campoBuscaPagina.value = termo;
      campoBuscaPagina.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  campoBuscaPagina.addEventListener('input', () => {
    if (!campoBuscaPagina.value.trim()) {
      topbarBusca.value = '';
    }
  });
}

window.BabycareUI = {
  API_URL: UI_API_URL,
  esconderCarregamento,
  mostrarCarregamento,
  transicionarPara,
  fazerLogout,
  mostrarToast,
  aplicarMascara,
  formatarCPF,
  formatarCNPJ,
  formatarTelefone,
  formatarCEP,
  formatarMoeda,
  formatarNumero,
  formatarData,
  formatarDataHora,
  validarEmailFrontend,
  configurarFormatacaoCampos,
  conectarBuscaTopbar,
  exportarCSV,
  confirmar,
  lerUsuario,
  atualizarUsuario,
};
