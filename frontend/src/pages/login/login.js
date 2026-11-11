import { API_URL } from '../../js/core/api.js';
import { limparSessao } from '../../js/core/index.js';

const loginForm = document.querySelector('#loginForm');
const emailInput = document.querySelector('#email');
const senhaInput = document.querySelector('#senha');
const lembrarInput = document.querySelector('#lembrar');
const loginButton = document.querySelector('#loginButton');
const formMessage = document.querySelector('#formMessage');
const togglePassword = document.querySelector('#togglePassword');
const forgotPassword = document.querySelector('#forgotPassword');
const requestAccess = document.querySelector('#requestAccess');

function mostrarMensagem(texto, tipo = '') {
  formMessage.textContent = texto;
  formMessage.className = `form-message ${tipo}`.trim();
}

function alterarEstadoDoBotao(carregando) {
  loginButton.disabled = carregando;
  loginButton.classList.toggle('is-loading', carregando);
}

function validarFormulario() {
  const email = emailInput.value.trim();
  const senha = senhaInput.value;

  if (!email || !senha) {
    mostrarMensagem('Preencha seu e-mail e sua senha.', 'error');
    return false;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    mostrarMensagem('Digite um e-mail válido.', 'error');
    emailInput.focus();
    return false;
  }

  return true;
}

async function salvarSessao(resultado) {
  const armazenamento = lembrarInput.checked ? localStorage : sessionStorage;
  const outroArmazenamento = lembrarInput.checked ? sessionStorage : localStorage;

  outroArmazenamento.removeItem('babycareUsuario');
  armazenamento.setItem('babycareUsuario', JSON.stringify(resultado.usuario));
}

async function obterResposta(resposta) {
  try {
    return await resposta.json();
  } catch (erro) {
    return {};
  }
}

async function fazerLogin(event) {
  event.preventDefault();
  mostrarMensagem('');

  if (!validarFormulario()) {
    return;
  }

  alterarEstadoDoBotao(true);

  try {
    const resposta = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        senha: senhaInput.value,
      }),
      credentials: 'include',
      cache: 'no-store',
    });

    const resultado = await obterResposta(resposta);

    if (!resposta.ok) {
      throw new Error(resultado.mensagem || 'Não foi possível realizar o login.');
    }

    if (!resultado.usuario) {
      throw new Error('O servidor não retornou uma sessão válida.');
    }

    salvarSessao(resultado);
    mostrarMensagem('Login realizado. Redirecionando...', 'success');

    document.body.classList.add('is-leaving');
    const tempoTransicao = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 720;

    window.setTimeout(() => {
      window.location.assign('./dashboard.html');
    }, tempoTransicao);
  } catch (erro) {
    const mensagem =
      erro.name === 'TypeError'
        ? 'Não foi possível conectar ao servidor. Verifique se o backend está rodando.'
        : erro.message || 'Não foi possível realizar o login.';

    mostrarMensagem(mensagem, 'error');
  } finally {
    alterarEstadoDoBotao(false);
  }
}

togglePassword.addEventListener('click', () => {
  const senhaVisivel = senhaInput.type === 'text';
  senhaInput.type = senhaVisivel ? 'password' : 'text';
  togglePassword.setAttribute('aria-label', senhaVisivel ? 'Mostrar senha' : 'Ocultar senha');
  togglePassword.setAttribute('aria-pressed', String(!senhaVisivel));
});

forgotPassword.addEventListener('click', (event) => {
  event.preventDefault();
  const email = window.prompt('Informe seu e-mail cadastrado:');
  if (!email) {
    return;
  }
  fetch(`${API_URL}/auth/esqueci-senha`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
    credentials: 'include',
  })
    .then((r) => r.json())
    .then((data) => {
      mostrarMensagem(
        data.mensagem || 'Se o e-mail estiver cadastrado, você receberá instruções.',
        'success'
      );
    })
    .catch(() => {
      mostrarMensagem('Não foi possível processar a solicitação.', 'error');
    });
});

requestAccess.addEventListener('click', (event) => {
  event.preventDefault();
  mostrarMensagem(
    'Entre em contato com o administrador para solicitar acesso.',
    'success'
  );
});

loginForm.addEventListener('submit', fazerLogin);

// Se já houver uma sessão no cookie HttpOnly, redireciona para o dashboard.
window.addEventListener('load', async () => {
  try {
    const resposta = await fetch(`${API_URL}/perfil`, {
      credentials: 'include',
      cache: 'no-store',
    });
    if (resposta.ok) {
      window.location.replace('./dashboard.html');
    } else if (resposta.status !== 401) {
      mostrarMensagem('Não foi possível verificar sua sessão. Você ainda pode tentar entrar.', 'error');
    }
  } catch {
    mostrarMensagem('Não foi possível verificar sua sessão. Você ainda pode tentar entrar.', 'error');
  }
});
