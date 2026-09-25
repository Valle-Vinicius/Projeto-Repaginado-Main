// public/js/login.js
// Tela de login: login normal, login com Google, validações e controles visuais.

// Usa o mesmo endereço que está servindo a página.
// Assim, funciona em localhost:3000 sem precisar alterar a porta manualmente.
const API_URL = window.location.origin;

const form = document.getElementById('loginForm');
const inputEmail = document.getElementById('email');
const inputSenha = document.getElementById('password');
const emailWrapper = document.getElementById('emailWrapper');
const passwordWrapper = document.getElementById('passwordWrapper');
const erroEmail = document.getElementById('emailError');
const erroSenha = document.getElementById('passwordError');
const erroGeral = document.getElementById('formError');
const capsLockAviso = document.getElementById('capsLockWarning');
const btnSubmit = document.getElementById('submitBtn');
const textoSubmit = document.getElementById('submitText');
const spinnerSubmit = document.getElementById('submitSpinner');
const btnTogglePassword = document.getElementById('togglePassword');
const iconeAberto = document.getElementById('eyeIconOpen');
const iconeFechado = document.getElementById('eyeIconClosed');
const checkboxLembrar = document.getElementById('rememberMe');
const btnGoogle = document.getElementById('googleLoginBtn');

// -------------------------------------------
// LOGIN COM GOOGLE
// -------------------------------------------

if (btnGoogle) {
    btnGoogle.addEventListener('click', () => {
        // A rota correta é /api/auth/google porque no app.js existe:
        // app.use('/api/auth', authRoutes);
        window.location.href = `${API_URL}/api/auth/google`;
    });
}

// Se o backend retornar para esta página com token e dados do usuário,
// salva as informações e abre o dashboard.
function verificarRetornoDoGoogle() {
    const parametros = new URLSearchParams(window.location.search);

    const erro = parametros.get('erro');

    if (erro === 'google_cancelado') {
        mostrarErroGeral('Login com Google cancelado.');
        limparUrl();
        return;
    }

    if (erro === 'google_falhou') {
        mostrarErroGeral('Não foi possível entrar com o Google. Tente novamente.');
        limparUrl();
        return;
    }

    const token = parametros.get('token');

    // Não veio de um redirecionamento do Google.
    if (!token) return;

    const usuario = {
        id: parametros.get('id'),
        nome: parametros.get('nome'),
        email: parametros.get('email'),
        perfil: parametros.get('perfil')
    };

    localStorage.setItem('babycare_token', token);
    localStorage.setItem('babycare_usuario', JSON.stringify(usuario));

    limparUrl();
    window.location.href = 'dashboard.html';
}

function limparUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
}

function mostrarErroGeral(mensagem) {
    if (!erroGeral) return;

    erroGeral.textContent = mensagem;
    erroGeral.hidden = false;
}

verificarRetornoDoGoogle();

// -------------------------------------------
// MOSTRAR / ESCONDER SENHA
// -------------------------------------------

if (btnTogglePassword) {
    btnTogglePassword.addEventListener('click', () => {
        const mostrando = inputSenha.getAttribute('type') === 'text';

        inputSenha.setAttribute('type', mostrando ? 'password' : 'text');
        iconeAberto.hidden = mostrando;
        iconeFechado.hidden = !mostrando;
        btnTogglePassword.setAttribute('aria-pressed', String(!mostrando));
        btnTogglePassword.setAttribute(
            'aria-label',
            mostrando ? 'Mostrar senha' : 'Ocultar senha'
        );
    });
}

// -------------------------------------------
// AVISO DE CAPS LOCK
// -------------------------------------------

inputSenha.addEventListener('keyup', (evento) => {
    const capsAtivado = evento.getModifierState &&
        evento.getModifierState('CapsLock');

    capsLockAviso.hidden = !capsAtivado;
});

inputSenha.addEventListener('blur', () => {
    capsLockAviso.hidden = true;
});

// -------------------------------------------
// VALIDAÇÕES
// -------------------------------------------

function validarEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

function marcarInvalido(wrapper, spanErro, mensagem) {
    wrapper.classList.add('has-error');
    spanErro.textContent = mensagem;
}

function limparCampo(wrapper, spanErro) {
    wrapper.classList.remove('has-error');
    spanErro.textContent = '';
}

function limparTudo() {
    limparCampo(emailWrapper, erroEmail);
    limparCampo(passwordWrapper, erroSenha);
    erroGeral.hidden = true;
    erroGeral.textContent = '';
}

function validarFormulario(email, senha) {
    let valido = true;

    if (!email) {
        marcarInvalido(emailWrapper, erroEmail, 'Digite seu email');
        valido = false;
    } else if (!validarEmail(email)) {
        marcarInvalido(emailWrapper, erroEmail, 'Email inválido');
        valido = false;
    }

    if (!senha) {
        marcarInvalido(passwordWrapper, erroSenha, 'Digite sua senha');
        valido = false;
    } else if (senha.length < 8) {
        marcarInvalido(
            passwordWrapper,
            erroSenha,
            'Senha precisa ter no mínimo 8 caracteres'
        );
        valido = false;
    }

    return valido;
}

// -------------------------------------------
// ESTADO DO BOTÃO DE LOGIN NORMAL
// -------------------------------------------

function atualizarEstadoBotao() {
    const emailOk = validarEmail(inputEmail.value.trim());
    const senhaOk = inputSenha.value.length >= 8;

    btnSubmit.disabled = !(emailOk && senhaOk);
}

inputEmail.addEventListener('input', () => {
    limparCampo(emailWrapper, erroEmail);
    atualizarEstadoBotao();
});

inputSenha.addEventListener('input', () => {
    limparCampo(passwordWrapper, erroSenha);
    atualizarEstadoBotao();
});

// -------------------------------------------
// ESTADO DE CARREGAMENTO
// -------------------------------------------

function ativarCarregando() {
    btnSubmit.disabled = true;
    textoSubmit.textContent = 'Entrando...';
    spinnerSubmit.hidden = false;
}

function desativarCarregando() {
    textoSubmit.textContent = 'Entrar no Sistema →';
    spinnerSubmit.hidden = true;
    atualizarEstadoBotao();
}

// -------------------------------------------
// SUBMIT DO LOGIN NORMAL
// -------------------------------------------

form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparTudo();

    const email = inputEmail.value.trim();
    const senha = inputSenha.value;

    if (!validarFormulario(email, senha)) return;

    ativarCarregando();

    try {
        // A rota correta é /api/auth/login porque no app.js existe:
        // app.use('/api/auth', authRoutes);
        const resposta = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, senha })
        });

        const dados = await resposta.json();

        if (resposta.ok) {
            const guardarToken = checkboxLembrar.checked
                ? localStorage
                : sessionStorage;

            guardarToken.setItem('babycare_token', dados.token);
            guardarToken.setItem(
                'babycare_usuario',
                JSON.stringify(dados.usuario)
            );

            textoSubmit.textContent = 'Tudo certo!';
            window.location.href = 'dashboard.html';
        } else {
            erroGeral.textContent = dados.mensagem ||
                'Não foi possível entrar';
            erroGeral.hidden = false;
            desativarCarregando();
        }
    } catch (erro) {
        console.error('Erro ao tentar logar:', erro);
        erroGeral.textContent =
            'Não foi possível conectar ao servidor. Tente novamente.';
        erroGeral.hidden = false;
        desativarCarregando();
    }
});
