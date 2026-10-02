(() => {
  function lerUsuarioDoArmazenamento(armazenamento) {
    const token = armazenamento.getItem('babycareToken');
    if (!token) return null;
    const raw = armazenamento.getItem('babycareUsuario') || armazenamento.getItem('babycareUser');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (erro) { return null; }
  }

  const usuario = lerUsuarioDoArmazenamento(sessionStorage)
    || lerUsuarioDoArmazenamento(localStorage)
    || {};
  const permitido = ['GERENTE', 'ADMINISTRADOR'].includes(
    String(usuario.perfil || '').trim().toUpperCase()
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
    botao.addEventListener('click', () => {
      ['babycareToken', 'babycareUsuario', 'babycareUser'].forEach((chave) => {
        localStorage.removeItem(chave);
        sessionStorage.removeItem(chave);
      });
    });
  });
})();
