import { API_URL } from '../../js/core/api.js';
import { requisitar } from '../../js/core/index.js';
import { atualizarUsuario, mostrarToast } from '../../js/core/ui.js';

const $ = (seletor) => document.querySelector(seletor);

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

function podeGerenciarUsuarios(usuario) {
  return ['GERENTE', 'ADMINISTRADOR'].includes(normalizarPerfil(usuario));
}

function aplicarPermissaoAdministracao(usuario) {
  const card = $('#gestaoCard');
  if (!card) {
    return;
  }

  const permitido = podeGerenciarUsuarios(usuario);

  card.hidden = !permitido;
  card.setAttribute('aria-hidden', String(!permitido));
  card.style.setProperty('display', permitido ? '' : 'none', 'important');
}

async function carregarUsuario() {
  const armazenamento = localStorage.getItem('babycareUsuario')
    ? localStorage
    : sessionStorage;
  let usuario = {};
  try {
    const raw = armazenamento.getItem('babycareUsuario');
    usuario = raw ? JSON.parse(raw) : {};
  } catch (erro) {
    // ignora
  }
  aplicarPermissaoAdministracao(usuario);
}

function mensagem(seletor, texto, erro = false) {
  const elemento = $(seletor);
  if (!elemento) {
    return;
  }

  elemento.textContent = texto;
  elemento.className = `message ${erro ? 'error' : 'success'}`;
  elemento.hidden = false;
}

async function carregarConfiguracoes() {
  window.BabycareCore.tornarBreadcrumbClicavel();
  window.BabycareCore.adicionarBotaoVoltar('.config-toolbar', 'Voltar ao dashboard');
  window.BabycareCore.adicionarContadorCaracteres();
  await atualizarUsuario();
  await carregarUsuario();

  $('#perfilForm')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const btn = evento.target.querySelector('button[type="submit"]');
    const textoOriginal = btn?.textContent;
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
      }
      const resposta = await requisitar(`${API_URL}/perfil`, {
        method: 'PATCH',
        body: JSON.stringify({
          nome: $('#nome')?.value.trim(),
          email: $('#email')?.value.trim(),
        }),
      });

      // Atualiza o storage com os dados frescos do banco
      const usuario = resposta.usuario || {};
      if (usuario.nome) {
        const armazenamento = localStorage.getItem('babycareUsuario')
          ? localStorage
          : sessionStorage;
        armazenamento.setItem('babycareUsuario', JSON.stringify(usuario));
        // Atualiza o topbar/sidebar imediatamente
        await atualizarUsuario();
      }

      mensagem('#perfilMensagem', 'Dados atualizados com sucesso.');
    } catch (erro) {
      mensagem('#perfilMensagem', erro.message, true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = textoOriginal || 'Salvar dados';
      }
    }
  });

  $('#senhaForm')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const btn = evento.target.querySelector('button[type="submit"]');
    const textoOriginal = btn?.textContent;
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Atualizando...';
      }
      await requisitar(`${API_URL}/perfil`, {
        method: 'PATCH',
        body: JSON.stringify({
          senhaAtual: $('#senhaAtual')?.value,
          novaSenha: $('#novaSenha')?.value,
          confirmarSenha: $('#confirmarSenha')?.value,
        }),
      });

      evento.target.reset();
      mensagem('#senhaMensagem', 'Senha atualizada com sucesso.');
    } catch (erro) {
      mensagem('#senhaMensagem', erro.message, true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = textoOriginal || 'Atualizar senha';
      }
    }
  });
}

window.addEventListener('load', carregarConfiguracoes);
