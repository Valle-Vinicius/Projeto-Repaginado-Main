/**
 * URL base da API do backend.
 * Em desenvolvimento, utiliza o proxy do Vite (/api → http://localhost:3000).
 * Em produção, utiliza VITE_API_URL definida no .env.
 */
export const API_URL = import.meta.env.VITE_API_URL || '/api';

let redirecionandoPorSessaoExpirada = false;

function tratarSessaoExpirada() {
  const caminho = window.location.pathname.replace(/\/+$/u, '') || '/';
  if (
    redirecionandoPorSessaoExpirada ||
    ['/login', '/login.html', '/src/pages/login/index.html'].includes(caminho)
  ) {
    return;
  }

  redirecionandoPorSessaoExpirada = true;
  sessionStorage.setItem(
    'babycare:returnAfterLogin',
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  );
  sessionStorage.setItem('babycare:sessionExpired', '1');
  ['babycareUsuario', 'babycareUser'].forEach((chave) => {
    localStorage.removeItem(chave);
    sessionStorage.removeItem(chave);
  });
  window.location.replace('/login');
}

export async function fetchAPI(input, options = {}) {
  const resposta = await fetch(input, {
    ...options,
    credentials: options.credentials ?? 'include',
  });

  if (resposta.status === 401) {
    tratarSessaoExpirada();
  }

  return resposta;
}

export default API_URL;
