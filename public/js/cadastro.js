// public/js/cadastro.js
// cuida da tela de cadastro: validação, medidor de força de senha,
// confirmação de senha, cadastro com google e chamada pro backend

const API_URL = 'http://localhost:3000';

// elementos do form
const form = document.getElementById('signupForm');
const inputNome = document.getElementById('fullName');
const inputEmail = document.getElementById('email');
const inputSenha = document.getElementById('password');
const inputConfirmar = document.getElementById('confirmPassword');
const checkboxTermos = document.getElementById('acceptTerms');

const nameWrapper = document.getElementById('nameWrapper');
const emailWrapper = document.getElementById('emailWrapper');
const passwordWrapper = document.getElementById('passwordWrapper');
const confirmWrapper = document.getElementById('confirmWrapper');

const erroNome = document.getElementById('nameError');
const erroEmail = document.getElementById('emailError');
const erroSenha = document.getElementById('passwordError');
const erroConfirmar = document.getElementById('confirmError');
const erroGeral = document.getElementById('formError');

const capsLockAviso = document.getElementById('capsLockWarning');
const btnTogglePassword = document.getElementById('togglePassword');
const iconeAberto = document.getElementById('eyeIconOpen');
const iconeFechado = document.getElementById('eyeIconClosed');

const strengthMeter = document.getElementById('strengthMeter');
const strengthLabel = document.getElementById('strengthLabel');
const barras = [
    document.getElementById('bar1'),
    document.getElementById('bar2'),
    document.getElementById('bar3'),
    document.getElementById('bar4')
];

const btnSubmit = document.getElementById('submitBtn');
const textoSubmit = document.getElementById('submitText');
const spinnerSubmit = document.getElementById('submitSpinner');

const successState = document.getElementById('successState');
const formWrapper = document.getElementById('formWrapper');

const btnGoogle = document.getElementById('googleSignupBtn');

// -------------------------------------------
// CADASTRO COM GOOGLE
// mesma rota do login: se o email do google ja existir vira login,
// se nao existir, cria a conta automaticamente
// -------------------------------------------
if (btnGoogle) {
    btnGoogle.addEventListener('click', () => {
        window.location.href = `${API_URL}/auth/google`;
    });
}

// -------------------------------------------
// MOSTRAR / ESCONDER SENHA
// -------------------------------------------
btnTogglePassword.addEventListener('click', () => {
    const mostrando = inputSenha.getAttribute('type') === 'text';

    inputSenha.setAttribute('type', mostrando ? 'password' : 'text');
    iconeAberto.hidden = mostrando;
    iconeFechado.hidden = !mostrando;
    btnTogglePassword.setAttribute('aria-pressed', String(!mostrando));
    btnTogglePassword.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
});

// -------------------------------------------
// AVISO DE CAPS LOCK
// -------------------------------------------
inputSenha.addEventListener('keyup', (evento) => {
    const capsAtivado = evento.getModifierState && evento.getModifierState('CapsLock');
    capsLockAviso.hidden = !capsAtivado;
});

inputSenha.addEventListener('blur', () => {
    capsLockAviso.hidden = true;
});

// -------------------------------------------
// MEDIDOR DE FORÇA DA SENHA
// vai de 0 a 4 pontos, cada regra que a senha cumpre soma 1 ponto
// -------------------------------------------
function calcularForcaSenha(senha) {
    let pontos = 0;

    if (senha.length >= 8) pontos++;
    if (senha.length >= 12) pontos++;
    if (/[A-Z]/.test(senha) && /[a-z]/.test(senha)) pontos++;
    if (/[0-9]/.test(senha) || /[^A-Za-z0-9]/.test(senha)) pontos++;

    return pontos; // 0 a 4
}

const NIVEIS = ['', 'weak', 'fair', 'good', 'strong'];
const TEXTOS = ['', 'Fraca', 'Razoável', 'Boa', 'Forte'];

function atualizarMedidorForca(senha) {
    if (!senha) {
        strengthMeter.setAttribute('aria-hidden', 'true');
        strengthLabel.textContent = '';
        barras.forEach((barra) => (barra.className = 'strength-bar'));
        return;
    }

    strengthMeter.setAttribute('aria-hidden', 'false');

    const pontos = calcularForcaSenha(senha);
    const nivel = NIVEIS[pontos] || 'weak';

    barras.forEach((barra, indice) => {
        barra.className = indice < pontos ? `strength-bar ${nivel}` : 'strength-bar';
    });

    strengthLabel.textContent = pontos > 0 ? `Força da senha: ${TEXTOS[pontos]}` : '';
}

inputSenha.addEventListener('input', () => {
    atualizarMedidorForca(inputSenha.value);
    limparCampo(passwordWrapper, erroSenha);
    // se a confirmacao ja tinha sido preenchida, reavalia ela tambem
    if (inputConfirmar.value) {
        validarConfirmacao();
    }
    atualizarEstadoBotao();
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

function limparErroGeral() {
    erroGeral.hidden = true;
    erroGeral.textContent = '';
}

function validarConfirmacao() {
    if (inputConfirmar.value && inputConfirmar.value !== inputSenha.value) {
        marcarInvalido(confirmWrapper, erroConfirmar, 'As senhas não coincidem');
        return false;
    }
    limparCampo(confirmWrapper, erroConfirmar);
    return true;
}

function validarFormulario() {
    let valido = true;

    const nome = inputNome.value.trim();
    const email = inputEmail.value.trim();
    const senha = inputSenha.value;
    const confirmar = inputConfirmar.value;

    if (!nome || nome.length < 3) {
        marcarInvalido(nameWrapper, erroNome, 'Digite seu nome completo');
        valido = false;
    }

    if (!email) {
        marcarInvalido(emailWrapper, erroEmail, 'Digite seu email');
        valido = false;
    } else if (!validarEmail(email)) {
        marcarInvalido(emailWrapper, erroEmail, 'Email inválido');
        valido = false;
    }

    if (!senha) {
        marcarInvalido(passwordWrapper, erroSenha, 'Digite uma senha');
        valido = false;
    } else if (senha.length < 8) {
        marcarInvalido(passwordWrapper, erroSenha, 'A senha precisa ter no mínimo 8 caracteres');
        valido = false;
    }

    if (!confirmar) {
        marcarInvalido(confirmWrapper, erroConfirmar, 'Confirme sua senha');
        valido = false;
    } else if (confirmar !== senha) {
        marcarInvalido(confirmWrapper, erroConfirmar, 'As senhas não coincidem');
        valido = false;
    }

    if (!checkboxTermos.checked) {
        erroGeral.textContent = 'Você precisa aceitar os Termos de Uso para continuar';
        erroGeral.hidden = false;
        valido = false;
    }

    return valido;
}

// -------------------------------------------
// BOTÃO SÓ FICA ATIVO QUANDO TUDO TÁ PREENCHIDO E OK
// (validacao "leve" so pra liberar o botao, a validacao completa
// roda de verdade no submit)
// -------------------------------------------
function atualizarEstadoBotao() {
    const nomeOk = inputNome.value.trim().length >= 3;
    const emailOk = validarEmail(inputEmail.value.trim());
    const senhaOk = inputSenha.value.length >= 8;
    const confirmarOk = inputConfirmar.value === inputSenha.value && inputConfirmar.value.length > 0;
    const termosOk = checkboxTermos.checked;

    btnSubmit.disabled = !(nomeOk && emailOk && senhaOk && confirmarOk && termosOk);
}

inputNome.addEventListener('input', () => {
    limparCampo(nameWrapper, erroNome);
    atualizarEstadoBotao();
});

inputEmail.addEventListener('input', () => {
    limparCampo(emailWrapper, erroEmail);
    atualizarEstadoBotao();
});

inputConfirmar.addEventListener('input', () => {
    validarConfirmacao();
    atualizarEstadoBotao();
});

checkboxTermos.addEventListener('change', () => {
    limparErroGeral();
    atualizarEstadoBotao();
});

// -------------------------------------------
// ESTADO DE CARREGANDO
// -------------------------------------------
function ativarCarregando() {
    btnSubmit.disabled = true;
    textoSubmit.textContent = 'Criando conta...';
    spinnerSubmit.hidden = false;
}

function desativarCarregando() {
    textoSubmit.textContent = 'Criar conta →';
    spinnerSubmit.hidden = true;
    atualizarEstadoBotao();
}

// -------------------------------------------
// TROCA SUAVE ENTRE FORM E ESTADO DE SUCESSO
// -------------------------------------------
function mostrarSucesso() {
    // fade-out do conteúdo atual antes de trocar
    formWrapper.classList.add('fade-out');

    setTimeout(() => {
        form.hidden = true;
        document.querySelector('.back-link').hidden = true;
        document.querySelector('.form-title').hidden = true;
        document.querySelector('.form-subtitle').hidden = true;
        document.querySelector('.signup-text').hidden = true;
        document.querySelector('.divider').hidden = true;
        document.querySelector('.social-buttons').hidden = true;

        successState.hidden = false;

        formWrapper.classList.remove('fade-out');
        formWrapper.classList.add('fade-in');
    }, 250); // precisa bater com a duração do .fade-out no CSS
}

// -------------------------------------------
// SUBMIT DO FORMULÁRIO
// -------------------------------------------
form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErroGeral();

    if (!validarFormulario()) return;

    ativarCarregando();

    const nome = inputNome.value.trim();
    const email = inputEmail.value.trim();
    const senha = inputSenha.value;

    try {
        const resposta = await fetch(`${API_URL}/auth/cadastrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nome, email, senha })
        });

        const dados = await resposta.json();

        if (resposta.ok) {
            mostrarSucesso();
        } else {
            erroGeral.textContent = dados.mensagem || 'Não foi possível criar a conta';
            erroGeral.hidden = false;
            desativarCarregando();
        }

    } catch (erro) {
        console.error('Erro ao cadastrar:', erro);
        erroGeral.textContent = 'Não foi possível conectar ao servidor. Tenta de novo.';
        erroGeral.hidden = false;
        desativarCarregando();
    }
});