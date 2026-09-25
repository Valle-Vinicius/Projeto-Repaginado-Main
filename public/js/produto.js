// public/js/produto.js
// cadastro de produto: validação client-side + integração com a API

const API_URL = 'http://localhost:3000/api';

const form = document.getElementById('produtoForm');
const erroGeral = document.getElementById('formError');

const btnSubmit = document.getElementById('submitBtn');
const textoSubmit = document.getElementById('submitText');
const spinnerSubmit = document.getElementById('submitSpinner');

// mapeamento campo -> { input, wrapper, erro }
const CAMPOS = [
    'codigo', 'nome', 'marca', 'categoria', 'faixaEtaria', 'tamanho',
    'quantidade', 'precoCusto', 'precoVenda', 'dataEntrada', 'dataSaida',
    'validade', 'observacoes'
].reduce((mapa, nomeCampo) => {
    mapa[nomeCampo] = {
        input: document.getElementById(nomeCampo),
        wrapper: document.getElementById(`${nomeCampo}Wrapper`),
        erro: document.getElementById(`${nomeCampo}Error`)
    };
    return mapa;
}, {});

const CAMPOS_OBRIGATORIOS = ['codigo', 'nome', 'quantidade'];

// -------------------------------------------
// HELPERS DE ERRO/VALIDAÇÃO VISUAL
// -------------------------------------------
function marcarInvalido(nomeCampo, mensagem) {
    const campo = CAMPOS[nomeCampo];
    if (!campo || !campo.wrapper) return;

    campo.wrapper.classList.add('has-error');
    campo.wrapper.classList.remove('is-valid');
    if (campo.erro) campo.erro.textContent = mensagem;
}

function marcarValido(nomeCampo) {
    const campo = CAMPOS[nomeCampo];
    if (!campo || !campo.wrapper) return;

    campo.wrapper.classList.remove('has-error');
    if (campo.erro) campo.erro.textContent = '';

    if (campo.input && campo.input.value.trim()) {
        campo.wrapper.classList.add('is-valid');
    } else {
        campo.wrapper.classList.remove('is-valid');
    }
}

function limparTodosErros() {
    Object.keys(CAMPOS).forEach((nomeCampo) => {
        const campo = CAMPOS[nomeCampo];
        if (campo.wrapper) campo.wrapper.classList.remove('has-error');
        if (campo.erro) campo.erro.textContent = '';
    });
    erroGeral.hidden = true;
    erroGeral.textContent = '';
}

// -------------------------------------------
// VALIDAÇÃO CLIENT-SIDE (espelha a do backend, mas não substitui)
// -------------------------------------------
function validarFormulario() {
    let valido = true;
    limparTodosErros();

    const codigo = CAMPOS.codigo.input.value.trim();
    const nome = CAMPOS.nome.input.value.trim();
    const quantidade = CAMPOS.quantidade.input.value;
    const precoCusto = CAMPOS.precoCusto.input.value;
    const precoVenda = CAMPOS.precoVenda.input.value;
    const dataEntrada = CAMPOS.dataEntrada.input.value;
    const dataSaida = CAMPOS.dataSaida.input.value;
    const validade = CAMPOS.validade.input.value;

    if (!codigo) {
        marcarInvalido('codigo', 'Código interno é obrigatório');
        valido = false;
    }

    if (!nome || nome.length < 2) {
        marcarInvalido('nome', 'Nome do produto é obrigatório');
        valido = false;
    }

    if (quantidade === '' || Number(quantidade) < 0) {
        marcarInvalido('quantidade', 'Informe uma quantidade válida');
        valido = false;
    }

    if (precoCusto !== '' && Number(precoCusto) < 0) {
        marcarInvalido('precoCusto', 'Preço de custo inválido');
        valido = false;
    }

    if (precoVenda !== '' && Number(precoVenda) < 0) {
        marcarInvalido('precoVenda', 'Preço de venda inválido');
        valido = false;
    }

    if (precoCusto && precoVenda && Number(precoVenda) < Number(precoCusto)) {
        marcarInvalido('precoVenda', 'Preço de venda não pode ser menor que o de custo');
        valido = false;
    }

    if (dataEntrada && dataSaida && new Date(dataSaida) < new Date(dataEntrada)) {
        marcarInvalido('dataSaida', 'Não pode ser anterior à data de entrada');
        valido = false;
    }

    if (validade) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (new Date(validade) < hoje) {
            marcarInvalido('validade', 'Validade não pode estar no passado');
            valido = false;
        }
    }

    return valido;
}

// -------------------------------------------
// HABILITAR BOTÃO SÓ QUANDO OBRIGATÓRIOS ESTIVEREM OK
// -------------------------------------------
function atualizarEstadoBotao() {
    const obrigatoriosOk = CAMPOS_OBRIGATORIOS.every((nomeCampo) => {
        const valor = CAMPOS[nomeCampo].input.value;
        if (nomeCampo === 'quantidade') return valor !== '' && Number(valor) >= 0;
        return valor.trim().length > 0;
    });

    btnSubmit.disabled = !obrigatoriosOk;
}

Object.keys(CAMPOS).forEach((nomeCampo) => {
    const campo = CAMPOS[nomeCampo];
    if (!campo.input) return;

    campo.input.addEventListener('input', () => {
        marcarValido(nomeCampo);
        atualizarEstadoBotao();
    });
});

// -------------------------------------------
// ESTADO DE CARREGAMENTO
// -------------------------------------------
function ativarCarregando() {
    btnSubmit.disabled = true;
    textoSubmit.textContent = 'Salvando...';
    spinnerSubmit.hidden = false;
}

function desativarCarregando() {
    textoSubmit.textContent = 'Cadastrar Produto';
    spinnerSubmit.hidden = true;
    atualizarEstadoBotao();
}

// -------------------------------------------
// TOAST DE SUCESSO
// -------------------------------------------
function mostrarToast(mensagem) {
    const toastAntigo = document.querySelector('.toast');
    if (toastAntigo) toastAntigo.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
        </div>
        <div class="toast-body">
            <strong>Produto cadastrado</strong>
            <span>${mensagem}</span>
        </div>
        <button type="button" class="toast-close" aria-label="Fechar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
    `;

    document.body.appendChild(toast);

    const fechar = () => {
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', fechar);
    setTimeout(fechar, 4000);
}

// -------------------------------------------
// APLICAR ERROS VINDOS DO BACKEND (campo a campo)
// -------------------------------------------
function aplicarErrosBackend(camposComErro) {
    Object.entries(camposComErro || {}).forEach(([nomeCampo, mensagem]) => {
        marcarInvalido(nomeCampo, mensagem);
    });
}

// -------------------------------------------
// SUBMIT
// -------------------------------------------
form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    if (!validarFormulario()) return;

    ativarCarregando();

    const dados = {
        codigo: CAMPOS.codigo.input.value.trim(),
        nome: CAMPOS.nome.input.value.trim(),
        marca: CAMPOS.marca.input.value.trim(),
        categoria: CAMPOS.categoria.input.value.trim(),
        faixaEtaria: CAMPOS.faixaEtaria.input.value.trim(),
        tamanho: CAMPOS.tamanho.input.value.trim(),
        quantidade: CAMPOS.quantidade.input.value,
        precoCusto: CAMPOS.precoCusto.input.value,
        precoVenda: CAMPOS.precoVenda.input.value,
        dataEntrada: CAMPOS.dataEntrada.input.value,
        dataSaida: CAMPOS.dataSaida.input.value,
        validade: CAMPOS.validade.input.value,
        observacoes: CAMPOS.observacoes.input.value.trim()
    };

    try {
        const resposta = await fetch(`${API_URL}/produtos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        const corpo = await resposta.json();

        if (resposta.ok) {
            mostrarToast(`"${dados.nome}" foi adicionado ao catálogo.`);
            form.reset();
            Object.keys(CAMPOS).forEach((nomeCampo) => {
                const wrapper = CAMPOS[nomeCampo].wrapper;
                if (wrapper) wrapper.classList.remove('is-valid', 'has-error');
            });
            desativarCarregando();
        } else {
            erroGeral.textContent = corpo.mensagem || 'Não foi possível cadastrar o produto';
            erroGeral.hidden = false;
            aplicarErrosBackend(corpo.campos);
            desativarCarregando();
        }

    } catch (erro) {
        console.error('Erro ao cadastrar produto:', erro);
        erroGeral.textContent = 'Não foi possível conectar ao servidor. Tenta de novo.';
        erroGeral.hidden = false;
        desativarCarregando();
    }
});

atualizarEstadoBotao(); 