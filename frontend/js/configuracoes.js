(() => {
  const token = () =>
    localStorage.getItem("babycareToken") ||
    sessionStorage.getItem("babycareToken") ||
    "";

  const $ = (seletor) => document.querySelector(seletor);

  function normalizarPerfil(usuario = {}) {
    const valor =
      usuario.perfilCodigo ||
      usuario.perfil ||
      usuario.cargoCodigo ||
      usuario.cargo ||
      usuario.role ||
      "";

    return String(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase()
      .replace(/[ -]+/g, "_");
  }

  function podeGerenciarUsuarios(usuario) {
    return ["GERENTE", "ADMINISTRADOR"].includes(normalizarPerfil(usuario));
  }

  function aplicarPermissaoAdministracao(usuario) {
    const card = $("#gestaoCard");
    if (!card) return;

    const permitido = podeGerenciarUsuarios(usuario);

    card.hidden = !permitido;
    card.setAttribute("aria-hidden", String(!permitido));
    card.style.setProperty("display", permitido ? "" : "none", "important");
  }

  async function requisitar(url, opcoes = {}) {
    const resposta = await fetch(url, {
      ...opcoes,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token()}`,
        ...(opcoes.headers || {}),
      },
    });

    const corpo = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      const erro = new Error(
        corpo.mensagem || "Não foi possível concluir a operação.",
      );
      erro.status = resposta.status;
      throw erro;
    }

    return corpo;
  }

  function mensagem(seletor, texto, erro = false) {
    const elemento = $(seletor);
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.className = `message ${erro ? "error" : "success"}`;
    elemento.hidden = false;
  }

  async function carregarConfiguracoes() {
    const card = $("#gestaoCard");

    // Segurança: começa escondido e só aparece depois da confirmação da API.
    if (card) {
      card.hidden = true;
      card.setAttribute("aria-hidden", "true");
      card.style.setProperty("display", "none", "important");
    }

    try {
      const resposta = await requisitar("/api/perfil");
      const usuario = resposta.usuario || {};

      if ($("#nome")) $("#nome").value = usuario.nome || "";
      if ($("#email")) $("#email").value = usuario.email || "";

      aplicarPermissaoAdministracao(usuario);
    } catch (erro) {
      if ([401, 403].includes(erro.status)) {
        window.location.href = "./login.html";
        return;
      }

      mensagem("#perfilMensagem", erro.message, true);
    }
  }

  $("#perfilForm")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    try {
      await requisitar("/api/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          nome: $("#nome")?.value.trim(),
          email: $("#email")?.value.trim(),
        }),
      });

      mensagem("#perfilMensagem", "Dados atualizados com sucesso.");
    } catch (erro) {
      mensagem("#perfilMensagem", erro.message, true);
    }
  });

  $("#senhaForm")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    try {
      await requisitar("/api/perfil", {
        method: "PATCH",
        body: JSON.stringify({
          senhaAtual: $("#senhaAtual")?.value,
          novaSenha: $("#novaSenha")?.value,
          confirmarSenha: $("#confirmarSenha")?.value,
        }),
      });

      evento.target.reset();
      mensagem("#senhaMensagem", "Senha atualizada com sucesso.");
    } catch (erro) {
      mensagem("#senhaMensagem", erro.message, true);
    }
  });

  window.addEventListener("load", carregarConfiguracoes);
})();
