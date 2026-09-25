// public/js/dashboard.js
// busca os dados do backend e popula o dashboard (KPIs, tabela de
// estoque baixo, movimentações recentes). se a API falhar, mantém
// os dados estáticos que já estão no HTML como fallback.

const API_URL = window.location.origin;

// elementos
const elSaudacao = document.getElementById('saudacao');

const elKpiProdutos = document.getElementById('kpiProdutos');
const elKpiEstoque = document.getElementById('kpiEstoque');
const elKpiBaixo = document.getElementById('kpiBaixo');
const elKpiValor = document.getElementById('kpiValor');

const elTabelaEstoqueBaixo = document.getElementById('tabelaEstoqueBaixo');
const elListaMovimentacoes = document.getElementById('listaMovimentacoes');

// -------------------------------------------
// SAUDAÇÃO DINÂMICA
// -------------------------------------------
function definirSaudacao() {
    if (!elSaudacao) return;

    const hora = new Date().getHours();
    let texto = 'Boa noite';

    if (hora >= 5 && hora < 12) texto = 'Bom dia';
    else if (hora >= 12 && hora < 18) texto = 'Boa tarde';

    elSaudacao.textContent = `${texto}, visão geral`;
}

// -------------------------------------------
// FORMATADORES
// -------------------------------------------
const formatarNumero = (valor) => new Intl.NumberFormat('pt-BR').format(valor);

const formatarMoeda = (valor) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 1
    }).format(valor);

// -------------------------------------------
// ANIMAÇÃO DE CONTAGEM NOS KPIs
// -------------------------------------------
function animarNumero(elemento, valorFinal, { moeda = false, duracao = 700 } = {}) {
    if (!elemento) return;

    const valorInicial = 0;
    const inicio = performance.now();

    function passo(agora) {
        const progresso = Math.min((agora - inicio) / duracao, 1);
        const facilitado = 1 - Math.pow(1 - progresso, 3); // ease-out cubic
        const valorAtual = valorInicial + (valorFinal - valorInicial) * facilitado;

        elemento.textContent = moeda
            ? formatarMoeda(valorAtual)
            : formatarNumero(Math.round(valorAtual));

        if (progresso < 1) {
            requestAnimationFrame(passo);
        } else {
            elemento.textContent = moeda ? formatarMoeda(valorFinal) : formatarNumero(valorFinal);
        }
    }

    requestAnimationFrame(passo);
}

// -------------------------------------------
// PREENCHER KPIs
// -------------------------------------------
function preencherKpis(dados) {
    if (dados.produtosCadastrados != null) {
        animarNumero(elKpiProdutos, dados.produtosCadastrados);
    }
    if (dados.itensEmEstoque != null) {
        animarNumero(elKpiEstoque, dados.itensEmEstoque);
    }
    if (dados.estoqueBaixoQtd != null) {
        animarNumero(elKpiBaixo, dados.estoqueBaixoQtd);
    }
    if (dados.valorEmEstoque != null) {
        animarNumero(elKpiValor, dados.valorEmEstoque, { moeda: true });
    }
}

// -------------------------------------------
// PREENCHER TABELA DE ESTOQUE BAIXO
// -------------------------------------------
function preencherTabelaEstoqueBaixo(produtos) {
    if (!elTabelaEstoqueBaixo) return;

    if (!produtos || produtos.length === 0) {
        elTabelaEstoqueBaixo.innerHTML = `
            <tr>
                <td colspan="4" style="text-align:center; color: var(--color-text-muted);">
                    Nenhum produto com estoque baixo no momento.
                </td>
            </tr>
        `;
        return;
    }

    elTabelaEstoqueBaixo.innerHTML = produtos
        .map((produto) => `
                <tr>
                    <td>${escaparHTML(produto.nome)}</td>
                    <td>${escaparHTML(produto.categoria)}</td>
                    <td>${formatarNumero(produto.quantidade)} un.</td>
                </tr>
            `)
        .join('');
}

// -------------------------------------------
// PREENCHER MOVIMENTAÇÕES RECENTES
// -------------------------------------------
function tempoRelativo(dataISO) {
    const diffMs = Date.now() - new Date(dataISO).getTime();
    const minutos = Math.floor(diffMs / 60000);

    if (minutos < 1) return 'agora mesmo';
    if (minutos < 60) return `há ${minutos} min`;

    const horas = Math.floor(minutos / 60);
    if (horas < 24) return `há ${horas} h`;

    const dias = Math.floor(horas / 24);
    return `há ${dias} d`;
}

function preencherMovimentacoes(movimentacoes) {
    if (!elListaMovimentacoes) return;

    if (!movimentacoes || movimentacoes.length === 0) {
        elListaMovimentacoes.innerHTML = `
            <li style="justify-content:center; color: var(--color-text-muted);">
                Nenhuma movimentação recente.
            </li>
        `;
        return;
    }

    elListaMovimentacoes.innerHTML = movimentacoes
        .map((mov) => {
            const entrada = mov.tipo === 'entrada';

            return `
                <li>
                    <div class="activity-icon">${entrada ? '+' : '−'}</div>
                    <div>
                        <div class="activity-title">
                            ${formatarNumero(mov.quantidade)} unidades ${entrada ? 'adicionadas' : 'vendidas'}
                        </div>
                        <div class="activity-meta">
                            ${escaparHTML(mov.produto)} · ${tempoRelativo(mov.data)}
                        </div>
                    </div>
                </li>
            `;
        })
        .join('');
}

// -------------------------------------------
// SEGURANÇA: evita injeção de HTML nos dados vindos da API
// -------------------------------------------
function escaparHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto ?? '';
    return div.innerHTML;
}

// -------------------------------------------
// BUSCAR DADOS DO BACKEND
// -------------------------------------------
async function carregarDashboard() {
    try {
        const resposta = await fetch(`${API_URL}/dashboard`);

        if (!resposta.ok) throw new Error('Falha ao buscar dados do dashboard');

        const dados = await resposta.json();

        if (dados.kpis) preencherKpis(dados.kpis);
        if (dados.estoqueBaixo) preencherTabelaEstoqueBaixo(dados.estoqueBaixo);
        if (dados.movimentacoes) preencherMovimentacoes(dados.movimentacoes);

    } catch (erro) {
        // sem servidor rodando (ou erro de rede), mantém o conteúdo
        // estático que já está no HTML como fallback e só avisa no console
        console.warn('Não foi possível carregar dados dinâmicos do dashboard:', erro.message);
    }
}

// -------------------------------------------
// INICIALIZAÇÃO
// -------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    definirSaudacao();
    carregarDashboard();
});


// -------------------------------------------
// ONBOARDING / PRIMEIRO ACESSO
// -------------------------------------------

const onboarding = {
    modal: document.getElementById('dashboardOnboarding'),
    form: document.getElementById('onboardingForm'),
    nome: document.getElementById('onboardingNome'),
    area: document.getElementById('onboardingArea'),
    objetivo: document.getElementById('onboardingObjetivo'),
    erro: document.getElementById('onboardingError'),
    next: document.getElementById('onboardingNext'),
    back: document.getElementById('onboardingBack'),
    buttonText: document.getElementById('onboardingButtonText'),
    spinner: document.getElementById('onboardingSpinner'),
    close: document.getElementById('onboardingClose'),
    steps: Array.from(document.querySelectorAll('.onboarding-step')),
    progress: [
        document.getElementById('progressStepOne'),
        document.getElementById('progressStepTwo'),
        document.getElementById('progressStepThree')
    ]
};

let onboardingStepAtual = 1;

function obterUsuarioAtual() {
    const fontes = [localStorage, sessionStorage];

    for (const fonte of fontes) {
        try {
            const valor = fonte.getItem('babycare_usuario');
            if (valor) return JSON.parse(valor);
        } catch (erro) {
            console.warn('Não foi possível ler o usuário atual:', erro.message);
        }
    }

    return {};
}

function chaveDoOnboarding(usuario) {
    const identificador = usuario.email || usuario.id || 'visitante';
    return `babycare_onboarding_${String(identificador).toLowerCase()}`;
}

function obterPerfilSalvo(usuario) {
    try {
        const valor = localStorage.getItem(chaveDoOnboarding(usuario));
        return valor ? JSON.parse(valor) : null;
    } catch (erro) {
        console.warn('Não foi possível ler o perfil salvo:', erro.message);
        return null;
    }
}

function obterIniciais(nome) {
    const partes = String(nome || 'Babycare')
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

    return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase();
}

function horarioSaudacao() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return 'Bom dia';
    if (hora >= 12 && hora < 18) return 'Boa tarde';
    return 'Boa noite';
}

function aplicarPerfilNaTela(perfil, usuario) {
    const nome = perfil?.nome || usuario?.nome || 'Sua equipe';
    const area = perfil?.area || 'Perfil Babycare';

    const avatar = document.getElementById('avatarUsuarioSidebar');
    const nomeSidebar = document.getElementById('nomeUsuarioSidebar');
    const areaSidebar = document.getElementById('areaUsuarioSidebar');

    if (avatar) avatar.textContent = obterIniciais(nome);
    if (nomeSidebar) nomeSidebar.textContent = nome;
    if (areaSidebar) areaSidebar.textContent = area;
    if (elSaudacao) elSaudacao.textContent = `${horarioSaudacao()}, ${nome}`;
}

function mostrarErroOnboarding(mensagem) {
    if (!onboarding.erro) return;
    onboarding.erro.textContent = mensagem;
    onboarding.erro.hidden = false;
}

function limparErroOnboarding() {
    if (!onboarding.erro) return;
    onboarding.erro.textContent = '';
    onboarding.erro.hidden = true;
}

function renderizarEtapaOnboarding() {
    onboarding.steps.forEach((step, indice) => {
        const etapa = indice + 1;
        const visivel = etapa === onboardingStepAtual;
        step.hidden = !visivel;
        step.classList.toggle('is-visible', visivel);
    });

    onboarding.progress.forEach((item, indice) => {
        if (!item) return;
        item.classList.toggle('is-active', indice + 1 === onboardingStepAtual);
    });

    onboarding.back.hidden = onboardingStepAtual === 1;
    onboarding.buttonText.textContent = onboardingStepAtual === 3
        ? 'Entrar no dashboard'
        : 'Continuar';

    limparErroOnboarding();
}

function campoAtualValido() {
    if (onboardingStepAtual === 1) {
        const nome = onboarding.nome.value.trim();
        if (nome.length < 2) {
            mostrarErroOnboarding('Digite um nome com pelo menos 2 caracteres.');
            onboarding.nome.focus();
            return false;
        }
    }

    if (onboardingStepAtual === 2 && !onboarding.area.value) {
        mostrarErroOnboarding('Selecione a área em que você atua.');
        onboarding.area.focus();
        return false;
    }

    if (onboardingStepAtual === 3 && !onboarding.objetivo.value) {
        mostrarErroOnboarding('Escolha o que você quer acompanhar primeiro.');
        onboarding.objetivo.focus();
        return false;
    }

    return true;
}

function definirCarregamentoOnboarding(carregando) {
    onboarding.next.disabled = carregando;
    onboarding.back.disabled = carregando;
    onboarding.buttonText.textContent = carregando ? 'Salvando...' : (
        onboardingStepAtual === 3 ? 'Entrar no dashboard' : 'Continuar'
    );
    onboarding.spinner.hidden = !carregando;
}

function salvarOnboarding(usuario) {
    const perfil = {
        nome: onboarding.nome.value.trim(),
        area: onboarding.area.value,
        objetivo: onboarding.objetivo.value,
        concluidoEm: new Date().toISOString()
    };

    localStorage.setItem(chaveDoOnboarding(usuario), JSON.stringify(perfil));
    aplicarPerfilNaTela(perfil, usuario);
    return perfil;
}

function fecharOnboarding() {
    onboarding.modal.classList.add('is-closing');

    window.setTimeout(() => {
        onboarding.modal.hidden = true;
        onboarding.modal.classList.remove('is-closing');
    }, 320);
}

function prepararOnboarding() {
    if (!onboarding.modal || !onboarding.form) return;

    const usuario = obterUsuarioAtual();
    const perfilSalvo = obterPerfilSalvo(usuario);

    if (perfilSalvo) {
        aplicarPerfilNaTela(perfilSalvo, usuario);
        onboarding.modal.hidden = true;
        return;
    }

    onboarding.nome.value = usuario.nome || '';
    onboardingStepAtual = 1;
    renderizarEtapaOnboarding();
    onboarding.modal.hidden = false;

    window.setTimeout(() => onboarding.nome.focus(), 380);

    onboarding.form.addEventListener('submit', (evento) => {
        evento.preventDefault();
        if (!campoAtualValido()) return;

        if (onboardingStepAtual < 3) {
            onboardingStepAtual += 1;
            renderizarEtapaOnboarding();

            const campoSeguinte = onboardingStepAtual === 2
                ? onboarding.area
                : onboarding.objetivo;

            window.setTimeout(() => campoSeguinte.focus(), 50);
            return;
        }

        definirCarregamentoOnboarding(true);

        // Pequena pausa para o spinner aparecer e a transição parecer natural.
        window.setTimeout(() => {
            salvarOnboarding(usuario);
            definirCarregamentoOnboarding(false);
            fecharOnboarding();
        }, 550);
    });

    onboarding.back.addEventListener('click', () => {
        if (onboardingStepAtual === 1) return;
        onboardingStepAtual -= 1;
        renderizarEtapaOnboarding();
    });
}

document.addEventListener('DOMContentLoaded', prepararOnboarding);
