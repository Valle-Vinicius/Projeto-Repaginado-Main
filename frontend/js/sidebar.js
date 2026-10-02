(() => {
  const sidebar = document.querySelector('#sidebar');
  if (!sidebar) return;

  function lerUsuario() {
    const ler = (storage) => {
      if (!storage.getItem('babycareToken')) return null;
      const raw = storage.getItem('babycareUsuario') || storage.getItem('babycareUser');
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return null; }
    };
    return ler(sessionStorage) || ler(localStorage) || {};
  }

  const usuario = lerUsuario();
  const perfil = String(usuario.perfil || '').toUpperCase();
  const podeGerenciarUsuarios = ['GERENTE', 'ADMINISTRADOR'].includes(perfil);
  const paginaAtual = window.location.pathname.split('/').pop() || 'dashboard.html';
  const links = [
    ['dashboard.html', 'Dashboard', '<rect x="4" y="4" width="6" height="6" rx="1"></rect><rect x="14" y="4" width="6" height="6" rx="1"></rect><rect x="4" y="14" width="6" height="6" rx="1"></rect><rect x="14" y="14" width="6" height="6" rx="1"></rect>'],
    ['produtos.html', 'Produtos', '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z"></path><path d="M4 7.5 12 12l8-4.5M12 12v9"></path>'],
    ['estoque.html', 'Estoque', '<path d="M4 7h16M4 12h16M4 17h10"></path><circle cx="18" cy="17" r="2"></circle>'],
    ['recebimentos.html', 'Recebimentos', '<path d="M6 4v14M6 18l-3-3m3 3 3-3M18 20V6m0 0-3 3m3-3 3 3"></path>'],
    ['expedicoes.html', 'Expedições', '<path d="M4 12h13M13 6l6 6-6 6"></path>'],
    ['relatorios.html', 'Relatórios', '<path d="M5 19V9M12 19V5M19 19v-7"></path>'],
    ['auditoria.html', 'Auditoria', '<circle cx="12" cy="12" r="8"></circle><path d="M12 8v4l2.5 2.5"></path>'],
    ['usuarios.html', 'Usuários', '<circle cx="9" cy="8" r="3"></circle><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 11h5M18.5 8.5v5"></path>', true]
  ];

  const nome = String(usuario.nome || 'Usuário Babycare');
  const perfilTexto = perfil ? perfil.replace(/_/g, ' ').toLocaleLowerCase('pt-BR').replace(/(^|\s)\S/g, (letra) => letra.toLocaleUpperCase('pt-BR')) : 'Perfil de acesso';
  const nomes = nome.split(/\s+/).filter(Boolean);
  const iniciais = (nomes.length > 1 ? nomes[0][0] + nomes.at(-1)[0] : nome.slice(0, 2)).toUpperCase();

  sidebar.innerHTML = `
    <div class="sidebar-top">
      <a class="brand" href="./dashboard.html" aria-label="Babycare - Dashboard">
        <img src="../images/babycare-logo.png" alt="Babycare">
      </a>
      <button id="closeSidebarButton" class="icon-button sidebar-close" type="button" aria-label="Fechar menu">×</button>
    </div>
    <label class="sidebar-search" for="sidebarSearch">
      <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4.5 4.5"></path></svg>
      <input id="sidebarSearch" type="search" placeholder="Pesquisar..." autocomplete="off">
      <span class="shortcut">Ctrl K</span>
    </label>
    <p class="nav-heading">MENU PRINCIPAL</p>
    <nav class="main-nav" aria-label="Navegação principal">
      ${links.map(([href, label, icon, somenteGestao]) => {
        if (somenteGestao && !podeGerenciarUsuarios) return '';
        const ativo = href === paginaAtual ? ' active' : '';
        return `<a class="nav-link${ativo}" href="./${href}"${href === paginaAtual ? ' aria-current="page"' : ''}><svg aria-hidden="true" viewBox="0 0 24 24">${icon}</svg><span>${label}</span></a>`;
      }).join('')}
    </nav>
    <p class="nav-heading nav-heading-secondary">SISTEMA</p>
    <nav class="secondary-nav">
      <button class="nav-link nav-link-button" type="button" data-coming-soon="Configurações"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"></path><circle cx="12" cy="12" r="3.5"></circle></svg><span>Configurações</span></button>
      <button class="nav-link nav-link-button" type="button" data-coming-soon="Ajuda e suporte"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M9.8 9a2.3 2.3 0 1 1 3.8 1.8c-1.1.8-1.6 1.2-1.6 2.5M12 16.5h.01"></path></svg><span>Ajuda e suporte</span></button>
    </nav>
    <div class="sidebar-user">
      <div id="sidebarAvatar" class="avatar" aria-hidden="true">${iniciais}</div>
      <div class="user-copy"><strong id="sidebarUserName">${nome}</strong><span id="sidebarUserRole">${perfilTexto}</span></div>
      <button id="logoutButton" class="logout-button" type="button" aria-label="Sair da conta"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10"></path></svg></button>
    </div>`;

  const abrir = document.querySelector('#openSidebarButton');
  const fechar = document.querySelector('#closeSidebarButton');
  abrir?.addEventListener('click', () => document.body.classList.add('sidebar-open'));
  fechar?.addEventListener('click', () => document.body.classList.remove('sidebar-open'));
  sidebar.querySelectorAll('.nav-link').forEach((link) => link.addEventListener('click', () => document.body.classList.remove('sidebar-open')));
  document.querySelector('#sidebarSearch')?.addEventListener('input', (evento) => {
    const termo = evento.target.value.toLocaleLowerCase('pt-BR');
    sidebar.querySelectorAll('.main-nav .nav-link').forEach((link) => { link.hidden = Boolean(termo) && !link.textContent.toLocaleLowerCase('pt-BR').includes(termo); });
  });
  document.querySelector('#logoutButton')?.addEventListener('click', () => {
    ['babycareToken', 'babycareUsuario', 'babycareUser'].forEach((chave) => { localStorage.removeItem(chave); sessionStorage.removeItem(chave); });
    window.location.href = './login.html';
  });
  sidebar.querySelectorAll('[data-coming-soon]').forEach((botao) => botao.addEventListener('click', () => window.BabycareUI?.mostrarToast(`O módulo ${botao.dataset.comingSoon} será desenvolvido na próxima etapa.`)));
})();
