const API_URL = window.location.origin;

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

function salvarSessao(resultado) {
  const armazenamento = lembrarInput.checked ? localStorage : sessionStorage;
  const outroArmazenamento = lembrarInput.checked ? sessionStorage : localStorage;

  outroArmazenamento.removeItem('babycareToken');
  outroArmazenamento.removeItem('babycareUsuario');
  armazenamento.setItem('babycareToken', resultado.token);
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

  if (!validarFormulario()) return;

  alterarEstadoDoBotao(true);

  try {
    const resposta = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: emailInput.value.trim(),
        senha: senhaInput.value
      }),
      cache: 'no-store'
    });

    const resultado = await obterResposta(resposta);

    if (!resposta.ok) {
      throw new Error(resultado.mensagem || 'Não foi possível realizar o login.');
    }

    if (!resultado.token || !resultado.usuario) {
      throw new Error('O servidor não retornou uma sessão válida.');
    }

    salvarSessao(resultado);
    mostrarMensagem('Login realizado. Redirecionando...', 'success');

    document.body.classList.add('is-leaving');
    const tempoTransicao = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 720;

    window.setTimeout(() => {
      window.location.assign('/pages/dashboard.html');
    }, tempoTransicao);
  } catch (erro) {
    const mensagem = erro.name === 'TypeError'
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
  mostrarMensagem('A recuperação de senha será disponibilizada em breve.', 'success');
});

requestAccess.addEventListener('click', (event) => {
  event.preventDefault();
  mostrarMensagem('Entre em contato com o administrador para solicitar acesso.', 'success');
});

loginForm.addEventListener('submit', fazerLogin);
