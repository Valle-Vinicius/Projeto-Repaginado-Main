(() => {
  function lerUsuarioDoArmazenamento(armazenamento) {
    const raw = armazenamento.getItem('babycareUsuario') || armazenamento.getItem('babycareUser');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (erro) { return null; }
  }

  const usuario = lerUsuarioDoArmazenamento(sessionStorage)
    || lerUsuarioDoArmazenamento(localStorage)
    || {};
  const permitido = ['GERENTE', 'ADMINISTRADOR'].includes(
    String(usuario.perfil || usuario.perfilCodigo || '').trim().toUpperCase()
  );

  // Funciona tanto com a nova marcação quanto com a sidebar HTML antiga.
  const links = document.querySelectorAll(
    '[data-usuarios-link], a[href$="/usuarios.html"], a[href$="./usuarios.html"], a[href="usuarios.html"]'
  );
  links.forEach((link) => {
    link.hidden = !permitido;
    link.style.display = permitido ? '' : 'none';
    link.setAttribute('aria-hidden', String(!permitido));
  });

  document.querySelectorAll('#logoutButton, #logout-button, [data-logout]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      if (window.BabycareUI?.fazerLogout) {
        await window.BabycareUI.fazerLogout();
        return;
      }
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch {}
      ['babycareToken', 'babycareUsuario', 'babycareUser'].forEach((chave) => {
        localStorage.removeItem(chave);
        sessionStorage.removeItem(chave);
      });
      window.location.href = './login.html';
    });
  });
})();
