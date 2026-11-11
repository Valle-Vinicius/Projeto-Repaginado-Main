import { API_URL } from '../../js/core/api.js';
import {
  lerUsuario as lerUsuarioCore,
  esc as escCore,
  perfilExibicao as perfilExibicaoCore,
  salvarFiltros as salvarFiltrosCore,
  carregarFiltros as carregarFiltrosCore,
  copiarParaAreaDeTransferencia,
  adicionarContadorCaracteres,
} from '../../js/core/index.js';
import {
  mostrarToast,
  conectarBuscaTopbar,
  exportarCSV,
  esconderCarregamento,
  atualizarUsuario,
} from '../../js/core/ui.js';

const USUARIOS_API_URL = `${API_URL}/usuarios`;
const $ = (s) => document.querySelector(s);
let opcoes = { perfis: [], departamentos: [] },
  editando = null,
  usuariosCache = [];

function usuarioAtual() {
  return lerUsuarioCore() || {};
}

function normalizarPerfil(usuario = {}) {
  const valor =
    usuario.perfilCodigo ||
    usuario.perfil ||
    usuario.cargoCodigo ||
    usuario.cargo ||
    usuario.role ||
    '';

  return String(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[ -]+/g, '_');
}

function temPermissaoGestao() {
  return ['GERENTE', 'ADMINISTRADOR'].includes(normalizarPerfil(usuarioAtual()));
}

function esc(v) {
  return escCore(v);
}

function data(v) {
  if (!v) {
    return 'Nunca';
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : window.BabycareUI.formatarDataHora(v);
}

function role(v) {
  return perfilExibicaoCore(v);
}

async function requisitar(url, opts = {}) {
  const r = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    credentials: 'include',
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(b.mensagem || 'Não foi possível concluir a operação.');
    e.status = r.status;
    throw e;
  }
  return b;
}

async function carregarOpcoes() {
  const b = await requisitar(`${USUARIOS_API_URL}/opcoes`);
  opcoes = { perfis: b.perfis || [], departamentos: b.departamentos || [] };
  $('#filtroPerfil').innerHTML =
    '<option value="">Todos os perfis</option>' +
    opcoes.perfis.map((x) => `<option value="${x.id}">${esc(role(x.nome))}</option>`).join('');
  $('#perfil').innerHTML = opcoes.perfis
    .map((x) => `<option value="${x.id}" data-nome="${esc(x.nome)}">${esc(role(x.nome))}</option>`)
    .join('');
  $('#departamento').innerHTML =
    '<option value="">Sem departamento</option>' +
    opcoes.departamentos.map((x) => `<option value="${x.id}">${esc(x.nome)}</option>`).join('');
}

async function carregar() {
  // Restaura filtros persistidos.
  const persistidos = carregarFiltrosCore('usuarios');
  if (persistidos.busca !== undefined) $('#busca').value = persistidos.busca;
  if (persistidos.perfilId !== undefined) $('#filtroPerfil').value = persistidos.perfilId;
  if (persistidos.ativo !== undefined) $('#filtroAtivo').value = persistidos.ativo;

  const q = new URLSearchParams({
    busca: $('#busca').value,
    perfilId: $('#filtroPerfil').value,
    ativo: $('#filtroAtivo').value,
  });
  try {
    const b = await requisitar(`${USUARIOS_API_URL}?${q}`);
    render(b.usuarios || []);
  } catch (e) {
    if ([401, 403].includes(e.status)) {
      location.href = './login.html';
      return;
    }
    $('#tabela').innerHTML = `<tr><td colspan="7" class="empty">${esc(e.message)}</td></tr>`;
  }
}

function render(items) {
  usuariosCache = items;
  $('#contador').textContent = `${items.length} usuário${items.length === 1 ? '' : 's'}`;
  $('#tabela').innerHTML = items.length
    ? items
        .map(
          (x) =>
            `<tr><td><strong>${esc(x.nome)}</strong></td><td class="email-cell">${esc(x.email)}<button type="button" class="copy-button" data-email="${esc(x.email)}" title="Copiar e-mail" aria-label="Copiar e-mail">📋</button></td><td>${esc(role(x.perfil))}</td><td>${esc(x.departamento || '—')}</td><td><span class="status ${x.ativo ? 'active' : 'inactive'}">${x.ativo ? 'Ativo' : 'Inativo'}</span></td><td>${esc(data(x.ultimoLoginEm))}</td><td><button class="edit-button" data-edit="${x.id}">Editar</button></td></tr>`
        )
        .join('')
    : '<tr><td colspan="7" class="empty">Nenhum usuário encontrado.</td></tr>';
  document
    .querySelectorAll('[data-edit]')
    .forEach((b) =>
      b.addEventListener('click', () => abrir(items.find((x) => String(x.id) === b.dataset.edit)))
    );
  document.querySelectorAll('.copy-button').forEach((b) => {
    b.addEventListener('click', async () => {
      const email = b.dataset.email;
      const ok = await copiarParaAreaDeTransferencia(email);
      const textoOriginal = b.textContent;
      b.textContent = ok ? '✓' : '✗';
      setTimeout(() => {
        b.textContent = textoOriginal;
      }, 1200);
    });
  });
  adicionarContadorCaracteres();
}

function abrir(item = null) {
  editando = item;
  $('#tituloModal').textContent = item ? 'Editar usuário' : 'Novo usuário';
  $('#usuarioId').value = item?.id || '';
  $('#nome').value = item?.nome || '';
  $('#email').value = item?.email || '';
  $('#perfil').value = item?.perfilId || opcoes.perfis[0]?.id || '';
  $('#departamento').value = item?.departamentoId || '';
  $('#senha').value = '';
  $('#senha').required = !item;
  $('#senhaAjuda').textContent = item
    ? 'deixe em branco para manter a senha atual'
    : 'obrigatória no cadastro';
  $('#ativo').checked = item ? Boolean(item.ativo) : true;
  $('#erro').hidden = true;
  $('#modal').hidden = false;
  $('#nome').focus();
}

function fechar() {
  $('#modal').hidden = true;
  editando = null;
}

async function salvar(e) {
  e.preventDefault();
  const perfilId = $('#perfil').value,
    perfilNome = $('#perfil option:checked')?.dataset.nome;
  const body = {
    nome: $('#nome').value.trim(),
    email: $('#email').value.trim(),
    perfil: perfilNome,
    departamentoId: $('#departamento').value || null,
    ativo: $('#ativo').checked,
  };
  if ($('#senha').value) {
    body.senha = $('#senha').value;
  }
  const url = editando ? `${USUARIOS_API_URL}/${editando.id}` : USUARIOS_API_URL;
  const btnSalvar = $('#formulario').querySelector('button[type="submit"]');
  const textoOriginal = btnSalvar?.textContent;
  try {
    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.textContent = 'Salvando...';
    }
    await requisitar(url, {
      method: editando ? 'PATCH' : 'POST',
      body: JSON.stringify(body),
    });
    fechar();
    await carregar();
  } catch (e) {
    $('#erro').textContent = e.message;
    $('#erro').hidden = false;
  } finally {
    if (btnSalvar) {
      btnSalvar.disabled = false;
      btnSalvar.textContent = textoOriginal || 'Salvar usuário';
    }
  }
}

$('#novoUsuario').addEventListener('click', () => abrir());
$('#fechar').addEventListener('click', fechar);
$('#cancelar').addEventListener('click', fechar);
$('#formulario').addEventListener('submit', salvar);
$('#atualizar').addEventListener('click', carregar);
$('#filtroPerfil').addEventListener('change', () => {
  salvarFiltrosCore('usuarios', {
    busca: $('#busca').value,
    perfilId: $('#filtroPerfil').value,
    ativo: $('#filtroAtivo').value,
  });
  carregar();
});
$('#filtroAtivo').addEventListener('change', () => {
  salvarFiltrosCore('usuarios', {
    busca: $('#busca').value,
    perfilId: $('#filtroPerfil').value,
    ativo: $('#filtroAtivo').value,
  });
  carregar();
});
let timer;
$('#busca').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => {
    salvarFiltrosCore('usuarios', {
      busca: $('#busca').value,
      perfilId: $('#filtroPerfil').value,
      ativo: $('#filtroAtivo').value,
    });
    carregar();
  }, 300);
});
conectarBuscaTopbar($('#busca'));
window.BabycareCore.tornarBreadcrumbClicavel();
window.BabycareCore.adicionarBotaoVoltar('.toolbar', 'Voltar ao dashboard');

window.addEventListener('load', async () => {
  try {
    await atualizarUsuario();
    if (!temPermissaoGestao()) {
      location.replace('./dashboard.html');
      return;
    }
    await carregarOpcoes();
    await carregar();
  } catch (e) {
    if ([401, 403].includes(e.status)) {
      location.replace('./dashboard.html');
      return;
    }
    $('#tabela').innerHTML = `<tr><td colspan="7" class="empty">${esc(e.message)}</td></tr>`;
  } finally {
    esconderCarregamento();
  }

  document.getElementById('usuExportarCsv')?.addEventListener('click', () => {
    if (!usuariosCache.length) {
      mostrarToast('Nenhum usuário para exportar.');
      return;
    }
    exportarCSV(
      usuariosCache.map((x) => ({
        Nome: x.nome,
        'E-mail': x.email,
        Perfil: x.perfil,
        Departamento: x.departamento || '—',
        Status: x.ativo ? 'Ativo' : 'Inativo',
        'Último login': x.ultimoLoginEm || '—',
      })),
      ['Nome', 'E-mail', 'Perfil', 'Departamento', 'Status', 'Último login'],
      'usuarios.csv'
    );
  });
});

