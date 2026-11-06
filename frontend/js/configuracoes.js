(() => {
  const $ = (seletor) => document.querySelector(seletor);
  const { requisitar: requisitarCore } = window.BabycareCore;

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

  async function requisitar(url, opcoes = {}) {
    return requisitarCore(url, opcoes);
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
    const card = $('#gestaoCard');

    // Segurança: começa escondido e só aparece depois da confirmação da API.
    if (card) {
      card.hidden = true;
      card.setAttribute('aria-hidden', 'true');
      card.style.setProperty('display', 'none', 'important');
    }

    try {
      const resposta = await requisitar('/api/perfil');
      const usuario = resposta.usuario || {};

      if ($('#nome')) {
        $('#nome').value = usuario.nome || '';
      }
      if ($('#email')) {
        $('#email').value = usuario.email || '';
      }

      aplicarPermissaoAdministracao(usuario);
    } catch (erro) {
      if ([401, 403].includes(erro.status)) {
        window.location.href = './login.html';
        return;
      }

      mensagem('#perfilMensagem', erro.message, true);
    }
  }

  $('#perfilForm')?.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const btn = evento.target.querySelector('button[type="submit"]');
    const textoOriginal = btn?.textContent;
    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Salvando...';
      }
      const resposta = await requisitar('/api/perfil', {
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
        if (window.BabycareUI?.atualizarUsuario) {
          await window.BabycareUI.atualizarUsuario();
        }
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
      await requisitar('/api/perfil', {
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

  window.addEventListener('load', carregarConfiguracoes);
})();
